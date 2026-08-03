import { useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import type { SiteCode } from '../types';
import {
  SEARCH_REGION_OPTIONS,
  type SearchRegionCode,
} from '../lib/search-regions';

const SITES: { code: SiteCode; label: string }[] = [
  { code: 'joonggonara', label: '중고나라' },
  { code: 'bungae', label: '번개장터' },
  { code: 'karrot', label: '당근' },
];

export function SearchToolbar({
  busy,
  keyword: keywordProp,
  onSubmit,
}: {
  busy: boolean;
  /** 현재 보고 있는 검색 키워드 — 이력 선택 시 동기화 */
  keyword?: string | null;
  onSubmit: (payload: {
    keyword: string;
    sites: SiteCode[];
    maxResultsPerSite: number;
    forceCrawl: boolean;
    regions: SearchRegionCode[];
  }) => void;
}) {
  const [keyword, setKeyword] = useState(keywordProp?.trim() || '');
  const [sites, setSites] = useState<SiteCode[]>([
    'joonggonara',
    'bungae',
    'karrot',
  ]);
  const [regions, setRegions] = useState<SearchRegionCode[]>(['all']);
  const [maxResults, setMaxResults] = useState(10);
  const [forceCrawl, setForceCrawl] = useState(false);

  const isNationwide = regions.includes('all') || regions.length === 0;

  useEffect(() => {
    if (keywordProp != null && keywordProp.trim()) {
      setKeyword(keywordProp.trim());
    }
  }, [keywordProp]);

  function toggleSite(code: SiteCode) {
    setSites((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  }

  function toggleRegion(code: SearchRegionCode) {
    if (code === 'all') {
      setRegions(['all']);
      return;
    }
    setRegions((prev) => {
      const withoutAll = prev.filter((c) => c !== 'all');
      if (withoutAll.includes(code)) {
        const next = withoutAll.filter((c) => c !== code);
        return next.length === 0 ? (['all'] as SearchRegionCode[]) : next;
      }
      return [...withoutAll, code];
    });
  }

  return (
    <form
      className="rounded-2xl border border-ink-100/80 bg-white/75 p-4 shadow-soft backdrop-blur sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!keyword.trim() || sites.length === 0 || busy) return;
        onSubmit({
          keyword: keyword.trim(),
          sites,
          maxResultsPerSite: maxResults,
          forceCrawl,
          regions: isNationwide ? ['all'] : regions,
        });
      }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
          Search
        </p>
        <h2 className="font-display text-xl text-ink-900 sm:text-2xl">
          검색조건
        </h2>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 block text-sm text-ink-500">키워드</span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full rounded-xl border border-ink-100 bg-sand-50 px-3 py-2.5 text-ink-900 outline-none focus:border-teal-600"
            placeholder="상품명 검색"
            autoFocus
          />
        </label>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy || !keyword.trim() || sites.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {forceCrawl ? (
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {busy ? '실행 중…' : '검색'}
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink-100 bg-sand-50 px-3 py-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={forceCrawl}
              onChange={(e) => setForceCrawl(e.target.checked)}
              className="accent-teal-700"
            />
            강제크롤
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-ink-500">사이트</span>
        {SITES.map((site) => {
          const on = sites.includes(site.code);
          return (
            <label
              key={site.code}
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink-800"
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggleSite(site.code)}
                className="accent-teal-700"
              />
              {site.label}
            </label>
          );
        })}
        <label className="ml-auto inline-flex items-center gap-2 text-sm text-ink-700">
          최대검색수
          <input
            type="number"
            min={1}
            max={50}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value) || 10)}
            className="w-16 rounded-lg border border-ink-100 bg-sand-50 px-2 py-1 outline-none focus:border-teal-600"
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="text-sm text-ink-500">지역</span>
          <span className="text-xs text-ink-400">
            중고나라·번개·당근 공통 · 당근은 동네 순회라 광역 검색이 더 길고, 연속
            강제크롤 시 일시 차단될 수 있음
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEARCH_REGION_OPTIONS.map((opt) => {
            const on =
              opt.code === 'all'
                ? isNationwide
                : !isNationwide && regions.includes(opt.code);
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => toggleRegion(opt.code)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  on
                    ? 'bg-teal-700 text-white'
                    : 'border border-ink-100 bg-sand-50 text-ink-700 hover:border-teal-600/40'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </form>
  );
}
