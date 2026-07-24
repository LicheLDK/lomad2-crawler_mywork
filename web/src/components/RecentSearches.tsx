import type { StatsOverview } from '../types';
import { formatDateShort, statusLabel, statusTone } from '../lib/format';

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

      {!stats ? (
        <p className="mt-6 text-sm text-ink-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">아직 검색 이력이 없습니다.</p>
      ) : (
        <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {items.map((item) => {
            const active = item.searchId === activeId;
            return (
              <li key={item.searchId}>
                <button
                  type="button"
                  onClick={() => onSelectSearch(item.searchId)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? 'border-teal-600/40 bg-teal-50/80 shadow-soft'
                      : 'border-ink-100/80 bg-sand-50/60 hover:border-ink-200 hover:bg-sand-100'
                  }`}
                >
                  <div className="font-medium leading-snug text-ink-900">
                    {item.keyword}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <span>{formatDateShort(item.createdAt)}</span>
                    <span className="text-ink-300">·</span>
                    <span>{item.resultCount}건</span>
                    <span
                      className={`ml-auto rounded-md px-2 py-0.5 ${statusTone(
                        item.status,
                      )}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
