import { Trash2 } from 'lucide-react';
import { formatDateShort, statusLabel, statusTone } from '../lib/format';
import { Skeleton } from './ui/skeleton';

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
  deletingId = null,
  emptyMessage = '아직 검색 이력이 없습니다.',
  loading = false,
}: {
  items: SearchHistoryItem[];
  activeId?: string | null;
  onSelectSearch: (id: string) => void;
  onDeleteSearch?: (id: string) => void;
  deletingId?: string | null;
  emptyMessage?: string;
  loading?: boolean;
}) {
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
    <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
      {items.map((item) => {
        const active = item.searchId === activeId;
        const deleting = deletingId === item.searchId;
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
                </div>
              </button>

              {onDeleteSearch ? (
                <button
                  type="button"
                  title="이력 삭제"
                  aria-label={`${item.keyword} 이력 삭제`}
                  disabled={deleting}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteSearch(item.searchId);
                  }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-white/90 text-ink-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
