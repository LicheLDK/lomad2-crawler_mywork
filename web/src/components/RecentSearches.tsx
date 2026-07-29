import type { StatsOverview } from '../types';
import { SearchHistoryCards } from './SearchHistoryCards';

export function RecentSearches({
  stats,
  activeId,
  onSelectSearch,
  onDeleteSearch,
  deletingId = null,
}: {
  stats: StatsOverview | null;
  activeId?: string | null;
  onSelectSearch: (id: string) => void;
  onDeleteSearch?: (id: string) => void | Promise<void>;
  deletingId?: string | null;
}) {
  const items = stats?.recentSearches ?? [];

  async function handleDelete(id: string) {
    if (!onDeleteSearch) return;
    const ok = window.confirm(
      '이 검색 이력을 삭제할까요?\n연결된 조사 케이스도 함께 삭제됩니다.',
    );
    if (!ok) return;
    await onDeleteSearch(id);
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-ink-100/80 bg-white/75 p-4 shadow-soft backdrop-blur sm:p-5">
      <div className="shrink-0">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
          History
        </p>
        <h2 className="font-display text-xl text-ink-900">최근 검색</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
          검색은 모두 저장됩니다. 항목을 클릭하면 해당 결과를 다시 불러옵니다.
        </p>
      </div>

      <SearchHistoryCards
        items={items}
        activeId={activeId}
        onSelectSearch={onSelectSearch}
        onDeleteSearch={onDeleteSearch ? handleDelete : undefined}
        deletingId={deletingId}
        loading={!stats}
      />
    </section>
  );
}
