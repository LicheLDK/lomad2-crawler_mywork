import type { StatsOverview } from '../types';
import { SearchHistoryCards } from './SearchHistoryCards';

export function RecentSearches({
  stats,
  activeId,
  onSelectSearch,
}: {
  stats: StatsOverview | null;
  activeId?: string | null;
  onSelectSearch: (id: string) => void;
}) {
  const items = stats?.recentSearches ?? [];

  return (
    <section className="flex h-full max-h-[70vh] flex-col rounded-2xl border border-ink-100/80 bg-white/75 p-4 shadow-soft backdrop-blur sm:p-5 lg:max-h-[calc(100vh-14rem)]">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
          History
        </p>
        <h2 className="font-display text-xl text-ink-900">최근 검색</h2>
      </div>

      <SearchHistoryCards
        items={items}
        activeId={activeId}
        onSelectSearch={onSelectSearch}
        loading={!stats}
      />
    </section>
  );
}
