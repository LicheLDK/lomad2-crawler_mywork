import { useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import type { SiteCode } from '../types';

const SITES: { code: SiteCode; label: string }[] = [
  { code: 'joonggonara', label: '중고나라' },
  { code: 'bungae', label: '번개장터' },
  { code: 'karrot', label: '당근' },
];

export function SearchToolbar({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (payload: {
    keyword: string;
    sites: SiteCode[];
    maxResultsPerSite: number;
    forceCrawl: boolean;
  }) => void;
}) {
  const [keyword, setKeyword] = useState('시몬스 침대');
  const [sites, setSites] = useState<SiteCode[]>([
    'joonggonara',
    'bungae',
    'karrot',
  ]);
  const [maxResults, setMaxResults] = useState(10);
  const [forceCrawl, setForceCrawl] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  function toggleSite(code: SiteCode) {
    setSites((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
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
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
            Search
          </p>
          <h2 className="font-display text-xl text-ink-900 sm:text-2xl">
            검색조건
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowOptions((v) => !v)}
          className="text-xs text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
        >
          {showOptions ? '옵션 숨기기' : '옵션'}
        </button>
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
        {showOptions ? (
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
        ) : null}
      </div>
    </form>
  );
}
