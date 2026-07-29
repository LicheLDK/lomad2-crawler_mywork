import { useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { SearchDetail, SearchResult } from '../types';
import { resolveAssetUrl } from '../api';
import {
  formatPrice,
  formatRelative,
  siteLabel,
  siteTone,
  statusLabel,
  statusTone,
  suspicionLabel,
} from '../lib/format';
import { useStartInvestigation } from '../features/investigation';
import { ResultDrawer } from './ResultDrawer';

type SortKey = 'similarity' | 'price' | 'date' | 'site';

function similarityBadgeTone(score?: number | null) {
  const pct =
    score != null && Number.isFinite(score) ? Math.round(score * 100) : null;
  if (pct == null) {
    return {
      pct: null as number | null,
      badge: 'bg-ink-100 text-ink-600 ring-ink-200/80',
      label: '유사도 —',
    };
  }
  if (pct >= 90) {
    return {
      pct,
      badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
      label: `유사도 ${pct}%`,
    };
  }
  if (pct >= 70) {
    return {
      pct,
      badge: 'bg-orange-50 text-orange-800 ring-orange-200/80',
      label: `유사도 ${pct}%`,
    };
  }
  return {
    pct,
    badge: 'bg-ink-100 text-ink-600 ring-ink-200/80',
    label: `유사도 ${pct}%`,
  };
}

function sortResults(rows: SearchResult[], sort: SortKey, siteFilter: string) {
  let list = [...rows];
  if (siteFilter !== 'all') {
    list = list.filter((r) => r.siteCode === siteFilter);
  }
  list.sort((a, b) => {
    if (sort === 'similarity') {
      return (b.titleSimilarity ?? -1) - (a.titleSimilarity ?? -1);
    }
    if (sort === 'price') {
      const pa = Number(a.price) || 0;
      const pb = Number(b.price) || 0;
      return pb - pa;
    }
    if (sort === 'date') {
      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    }
    return siteLabel(a.siteCode).localeCompare(siteLabel(b.siteCode), 'ko');
  });
  return list;
}

export function ResultsPanel({
  detail,
  busy,
}: {
  detail: SearchDetail | null;
  busy: boolean;
}) {
  const [sort, setSort] = useState<SortKey>('similarity');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [selected, setSelected] = useState<SearchResult | null>(null);
  /** Drawer 닫힌 직후 같은 클릭이 카드로 전달되어 다시 열리는 것 방지 */
  const ignoreSelectUntil = useRef(0);
  const startInvestigationFromResult = useStartInvestigation();

  function openDetail(row: SearchResult) {
    if (Date.now() < ignoreSelectUntil.current) return;
    setSelected(row);
  }

  function closeDetail() {
    ignoreSelectUntil.current = Date.now() + 400;
    setSelected(null);
  }

  function startInvestigation(row: SearchResult, e?: React.SyntheticEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    void startInvestigationFromResult(row, {
      searchHistoryId: row.searchHistoryId ?? detail?.searchId,
      searchJobId: detail?.jobId,
    });
  }

  const results = detail?.results || [];
  const filtered = useMemo(
    () => sortResults(results, sort, siteFilter),
    [results, sort, siteFilter],
  );
  const inFlight =
    busy ||
    detail?.status === 'running' ||
    detail?.status === 'queued';

  const siteOptions = useMemo(() => {
    const codes = Array.from(new Set(results.map((r) => r.siteCode)));
    return codes;
  }, [results]);

  const summary = useMemo(() => {
    if (!detail) return null;

    const bySite = new Map<string, number>();
    for (const r of results) {
      bySite.set(r.siteCode, (bySite.get(r.siteCode) || 0) + 1);
    }

    const scored = results
      .map((r) => r.titleSimilarity)
      .filter((v): v is number => v != null && Number.isFinite(v));
    const avgSimilarity =
      scored.length > 0
        ? Math.round(
            (scored.reduce((a, b) => a + b, 0) / scored.length) * 100,
          )
        : null;

    const start = detail.startedAt || detail.createdAt;
    const end = detail.finishedAt;
    let searchTime = '—';
    if (start) {
      const t0 = new Date(start).getTime();
      const t1 = end ? new Date(end).getTime() : Date.now();
      if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
        const sec = (t1 - t0) / 1000;
        if (sec < 60) {
          searchTime = `${sec.toFixed(1)}초`;
        } else {
          const m = Math.floor(sec / 60);
          const s = (sec % 60).toFixed(1);
          searchTime = `${m}분 ${s}초`;
        }
        if (!end && inFlight) searchTime = `${searchTime} (진행중)`;
      }
    }

    return {
      total: results.length || detail.resultCount || 0,
      bySite: Array.from(bySite.entries()).sort((a, b) => b[1] - a[1]),
      avgSimilarity,
      searchTime,
    };
  }, [detail, results, inFlight]);

  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-ink-100/80 bg-white/75 p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
            Results
          </p>
          <h2 className="font-display text-2xl text-ink-900">
            {detail?.keyword ? `검색 결과` : '검색 결과'}
          </h2>
          {detail ? (
            <p className="mt-1 text-sm text-ink-500">
              <span className="font-medium text-ink-800">{detail.keyword}</span>
              <span className="mx-1.5 text-ink-300">·</span>
              {filtered.length}
              {siteFilter !== 'all' ? ` / ${results.length}` : ''}건
            </p>
          ) : null}
        </div>
        {detail ? (
          <span
            className={`rounded-md px-2 py-0.5 text-sm ${statusTone(detail.status)} ${
              inFlight ? 'animate-pulseSoft' : ''
            }`}
          >
            {statusLabel(detail.status)}
          </span>
        ) : null}
      </div>

      {detail?.errorMessage ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {detail.errorMessage}
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-ink-100/80 pb-3 text-sm">
          <span className="text-ink-500">정렬</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-ink-100 bg-sand-50 px-2 py-1.5 outline-none focus:border-teal-600"
          >
            <option value="similarity">유사도 ▼</option>
            <option value="price">가격 ▼</option>
            <option value="date">기간 ▼</option>
            <option value="site">사이트</option>
          </select>
          <span className="ml-2 text-ink-500">사이트</span>
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="rounded-lg border border-ink-100 bg-sand-50 px-2 py-1.5 outline-none focus:border-teal-600"
          >
            <option value="all">전체</option>
            {siteOptions.map((code) => (
              <option key={code} value={code}>
                {siteLabel(code)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {summary ? (
        <div className="mt-4 rounded-xl border border-ink-100/80 bg-sand-50/70 px-4 py-3.5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
            Summary
          </p>
          <p className="mt-2 font-display text-xl text-ink-900">
            총 {summary.total}건
          </p>
          {summary.bySite.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-700">
              {summary.bySite.map(([code, count]) => (
                <span key={code}>
                  {siteLabel(code)}{' '}
                  <span className="font-medium tabular-nums text-ink-900">
                    {count}건
                  </span>
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
            <span>
              평균 유사도{' '}
              <span className="font-medium tabular-nums text-ink-900">
                {summary.avgSimilarity != null
                  ? `${summary.avgSimilarity}%`
                  : '—'}
              </span>
            </span>
            <span>
              검색시간{' '}
              <span className="font-medium tabular-nums text-ink-900">
                {summary.searchTime}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {!detail && !busy ? (
        <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-display text-xl text-ink-400">검색을 시작하세요</p>
          <p className="mt-2 max-w-sm text-sm text-ink-500">
            상단에서 키워드를 검색하거나, 왼쪽 최근 검색을 선택하면 결과가 여기에
            표시됩니다.
          </p>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="mt-4 grid flex-1 gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((row, i) => {
            const sim = similarityBadgeTone(row.titleSimilarity);
            const active =
              selected &&
              (selected.id || selected.url) === (row.id || row.url);
            return (
              <article
                key={row.id || row.url}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetail(row);
                  }
                }}
                className={`group animate-fadeUp flex cursor-pointer flex-col rounded-2xl border bg-white/90 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-teal-600/40 hover:shadow-soft ${
                  active
                    ? 'border-teal-600/50 shadow-soft ring-1 ring-teal-600/20'
                    : 'border-ink-100/80'
                }`}
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
              >
                {/* 1) 유사도 — 조사 핵심 */}
                <div
                  className={`rounded-xl px-3 py-3 text-center ring-1 ${sim.badge}`}
                >
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-80">
                    유사도
                  </div>
                  <div className="mt-0.5 font-display text-4xl leading-none tabular-nums">
                    {sim.pct != null ? `${sim.pct}%` : '—'}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug opacity-90">
                    {suspicionLabel(row.titleSimilarity)}
                  </p>
                </div>

                {/* 2) 사이트 Badge */}
                <div className="mt-2.5">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs ${siteTone(
                      row.siteCode,
                    )}`}
                  >
                    {siteLabel(row.siteCode)}
                  </span>
                </div>

                {/* 3) 이미지 */}
                <div className="mt-2.5 overflow-hidden rounded-xl bg-sand-100 ring-1 ring-ink-100/70">
                  {(() => {
                    const remote = row.imageUrl || null;
                    const local =
                      resolveAssetUrl(row.screenshotUrl) ||
                      row.screenshotUrl ||
                      null;
                    const primary = remote || local;
                    if (!primary) {
                      return (
                        <div className="flex aspect-[16/10] items-center justify-center text-xs text-ink-300">
                          No image
                        </div>
                      );
                    }
                    return (
                      <img
                        src={primary}
                        alt=""
                        className="aspect-[16/10] w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (local && !el.dataset.fallbackTried) {
                            el.dataset.fallbackTried = '1';
                            el.src = local;
                            return;
                          }
                          el.style.display = 'none';
                          const ph = el.parentElement?.querySelector(
                            '[data-no-image]',
                          ) as HTMLElement | null;
                          if (ph) ph.classList.remove('hidden');
                        }}
                      />
                    );
                  })()}
                  <div
                    data-no-image
                    className="hidden aspect-[16/10] items-center justify-center text-xs text-ink-300"
                  >
                    No image
                  </div>
                </div>

                {/* 4) 상품명 */}
                <h3 className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-ink-900">
                  {row.title}
                </h3>

                {/* 5) 가격 · 6) 등록일 */}
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-display text-lg tabular-nums text-ink-900">
                    {formatPrice(row.price)}
                  </span>
                  <span className="text-xs text-ink-500">
                    {formatRelative(row.createdAt)}
                  </span>
                </div>

                {/* 7) 조사 시작 — 페이지 이동 없음 */}
                <div className="mt-auto space-y-2 pt-3">
                  <button
                    type="button"
                    onClick={(e) => startInvestigation(row, e)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-teal-600/30 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 transition hover:bg-teal-100"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    조사 시작
                  </button>
                  <div className="text-sm font-medium text-teal-700 transition group-hover:text-teal-600">
                    상세 · AI 분석 →
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {detail && !inFlight && results.length === 0 ? (
        <p className="mt-8 text-sm text-ink-500">결과가 없습니다.</p>
      ) : null}

      <ResultDrawer
        row={selected}
        keyword={detail?.keyword}
        referenceImageUrl={detail?.referenceImageUrl}
        onClose={closeDetail}
        onStartInvestigation={startInvestigation}
      />
    </section>
  );
}
