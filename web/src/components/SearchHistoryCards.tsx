import { useState } from 'react';
import { Copy, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { formatDateShort, isRateLimitedError, statusLabel, statusTone } from '../lib/format';
import { Skeleton } from './ui/skeleton';
import { ConfirmDialog } from './ui/confirm-dialog';
import { DropdownMenu } from './ui/dropdown-menu';
import { toast } from './Toast';

export type SearchHistoryItem = {
  searchId: string;
  keyword: string;
  status: string;
  resultCount: number;
  sites?: string[] | null;
  createdAt: string;
  finishedAt?: string | null;
  errorMessage?: string | null;
};

/**
 * Dashboard Recent Search와 동일한 카드 리스트 (재사용)
 */
export function SearchHistoryCards({
  items,
  activeId,
  onSelectSearch,
  onDeleteSearch,
  onDuplicateSearch,
  deletingId = null,
  emptyMessage = '아직 검색 이력이 없습니다.',
  loading = false,
}: {
  items: SearchHistoryItem[];
  activeId?: string | null;
  onSelectSearch: (id: string) => void;
  onDeleteSearch?: (id: string) => void | Promise<void>;
  onDuplicateSearch?: (item: SearchHistoryItem) => void | Promise<void>;
  deletingId?: string | null;
  emptyMessage?: string;
  loading?: boolean;
}) {
  const [pending, setPending] = useState<SearchHistoryItem | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function confirmDelete() {
    if (!pending || !onDeleteSearch || confirmLoading) return;
    setConfirmLoading(true);
    try {
      await onDeleteSearch(pending.searchId);
      setPending(null);
      toast('검색 이력이 삭제되었습니다.');
    } catch {
      toast('삭제에 실패했습니다.', { tone: 'error' });
    } finally {
      setConfirmLoading(false);
    }
  }

  if (loading) {
    return (
      <ul
        className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1"
        aria-busy="true"
        aria-label="검색 이력 불러오는 중"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i}>
            <div className="flex items-center gap-2 rounded-xl border border-ink-100/80 bg-sand-50/60 px-3 py-2.5">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 max-w-[14rem]" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return <p className="mt-6 text-sm text-ink-500">{emptyMessage}</p>;
  }

  return (
    <>
      <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {items.map((item) => {
          const active = item.searchId === activeId;
          const deleting = deletingId === item.searchId;
          const menuItems = [
            {
              id: 'again',
              label: 'Search Again',
              icon: <RotateCcw className="h-3.5 w-3.5" />,
              onSelect: () => onSelectSearch(item.searchId),
            },
            {
              id: 'duplicate',
              label: 'Duplicate Search',
              icon: <Copy className="h-3.5 w-3.5" />,
              disabled: !onDuplicateSearch,
              onSelect: () => {
                void onDuplicateSearch?.(item);
              },
            },
            {
              id: 'delete',
              label: 'Delete',
              danger: true as const,
              icon: <Trash2 className="h-3.5 w-3.5" />,
              disabled: !onDeleteSearch,
              onSelect: () => setPending(item),
            },
          ];

          return (
            <li key={item.searchId}>
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
                  active
                    ? 'border-teal-600/40 bg-teal-50/80 shadow-soft'
                    : 'border-ink-100/80 bg-sand-50/60 hover:border-ink-200 hover:bg-sand-100'
                } ${deleting ? 'opacity-60' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectSearch(item.searchId)}
                  disabled={deleting}
                  className="min-w-0 flex-1 text-left"
                >
                  <div
                    className="truncate text-sm font-medium text-ink-900"
                    title={item.keyword}
                  >
                    {item.keyword}
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ink-500">
                    <span className="shrink-0">
                      {formatDateShort(item.createdAt)}
                    </span>
                    <span className="text-ink-300">·</span>
                    <span className="shrink-0 tabular-nums">
                      {item.resultCount}건
                    </span>
                    <span
                      className={`ml-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] ${statusTone(
                        item.status,
                      )}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                    {isRateLimitedError(item.errorMessage) ? (
                      <span
                        className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900"
                        title={item.errorMessage || undefined}
                      >
                        일시차단
                      </span>
                    ) : null}
                  </div>
                </button>

                <DropdownMenu
                  disabled={deleting}
                  aria-label={`${item.keyword} 더보기`}
                  trigger={
                    <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                  }
                  items={menuItems}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pending != null}
        title="검색 이력 삭제"
        variant="danger"
        confirmText="삭제"
        cancelText="취소"
        loading={confirmLoading}
        onCancel={() => {
          if (!confirmLoading) setPending(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      >
        {pending ? (
          <div className="space-y-3">
            <p>
              &ldquo;{pending.keyword}&rdquo; 검색 이력을 삭제하시겠습니까?
            </p>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-500">
                삭제되는 항목
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-ink-700">
                <li>검색 결과 캐시</li>
                <li>검색 이력</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-500">
                삭제되지 않는 항목
              </p>
              <ul className="mt-1.5 space-y-0.5 text-ink-700">
                <li>✓ Investigation</li>
                <li>✓ AI 분석 결과</li>
              </ul>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
