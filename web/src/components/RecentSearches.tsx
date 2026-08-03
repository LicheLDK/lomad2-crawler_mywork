import type { StatsOverview } from '../types';
import {
  SearchHistoryCards,
  type SearchHistoryItem,
} from './SearchHistoryCards';

export function RecentSearches({
  stats,
  activeId,
  onSelectSearch,
  onDeleteSearch,
  onDuplicateSearch,
  deletingId = null,
}: {
  stats: StatsOverview | null;
  activeId?: string | null;
  onSelectSearch: (id: string) => void;
  onDeleteSearch?: (id: string) => void | Promise<void>;
  onDuplicateSearch?: (item: SearchHistoryItem) => void | Promise<void>;
  deletingId?: string | null;
}) {
  const items = stats?.recentSearches ?? [];

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
        onDeleteSearch={onDeleteSearch}
        onDuplicateSearch={onDuplicateSearch}
        deletingId={deletingId}
        loading={!stats}
      />
    </section>
  );
}
