import { useMemo, useState } from 'react';
import type { StatsOverview } from '../types';
import {
  SearchHistoryCards,
  type SearchHistoryItem,
} from '../components/SearchHistoryCards';

type HistoryTab = 'recent' | 'saved' | 'favorite';

const TABS: { id: HistoryTab; label: string }[] = [
  { id: 'recent', label: '최근 검색' },
  { id: 'saved', label: '저장된 검색' },
  { id: 'favorite', label: '즐겨찾기 검색' },
];

const SAVED_KEY = 'crawler.dashboard.savedSearches';
const FAVORITE_KEY = 'crawler.dashboard.favoriteSearches';

function loadIdList(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]') as unknown;
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

function pickByIds(
  recent: SearchHistoryItem[],
  ids: string[],
): SearchHistoryItem[] {
  const map = new Map(recent.map((r) => [r.searchId, r]));
  return ids
    .map((id) => map.get(id))
    .filter((x): x is SearchHistoryItem => Boolean(x));
}

export function HistoryPage({
  stats,
  activeId,
  onSelectSearch,
}: {
  stats: StatsOverview | null;
  activeId?: string | null;
  onSelectSearch: (id: string) => void;
}) {
  const [tab, setTab] = useState<HistoryTab>('recent');
  const recent = stats?.recentSearches ?? [];

  const items = useMemo(() => {
    if (tab === 'recent') return recent;
    if (tab === 'saved') return pickByIds(recent, loadIdList(SAVED_KEY));
    return pickByIds(recent, loadIdList(FAVORITE_KEY));
  }, [tab, recent]);

  const emptyMessage =
    tab === 'recent'
      ? '아직 검색 이력이 없습니다.'
      : tab === 'saved'
        ? '저장된 검색이 없습니다.'
        : '즐겨찾기한 검색이 없습니다.';

  return (
    <section className="animate-fadeUp rounded-2xl border border-ink-100/80 bg-white/75 p-4 shadow-soft backdrop-blur sm:p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
          History
        </p>
        <h2 className="font-display text-xl text-ink-900">검색 이력</h2>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 rounded-xl border border-ink-100 bg-sand-50/60 p-1">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                on
                  ? 'bg-ink-900 font-medium text-sand-50'
                  : 'text-ink-600 hover:bg-sand-100 hover:text-ink-900'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 min-h-[240px]">
        <SearchHistoryCards
          items={items}
          activeId={activeId}
          onSelectSearch={onSelectSearch}
          loading={!stats}
          emptyMessage={emptyMessage}
        />
      </div>
    </section>
  );
}
