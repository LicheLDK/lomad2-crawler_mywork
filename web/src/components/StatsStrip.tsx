import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { StatsOverview } from '../types';
import { siteLabel } from '../lib/format';

export function StatsStrip({ stats }: { stats: StatsOverview | null }) {
  const [open, setOpen] = useState(false);

  const waiting = stats?.queue?.waiting ?? 0;
  const active = stats?.queue?.active ?? 0;
  const delayed = stats?.queue?.delayed ?? 0;
  const workerHint = active > 0 ? active : '—';

  const tiles = stats
    ? [
        { label: '검색', value: stats.totals.searches },
        { label: '결과', value: stats.totals.results },
        {
          label: '오늘',
          value: stats.last24h.results,
          hint: `검색 ${stats.last24h.searches}`,
        },
        { label: 'Worker', value: workerHint },
        {
          label: 'Queue',
          value: waiting + delayed,
          hint: active ? `active ${active}` : undefined,
        },
      ]
    : [];

  const peek = stats
    ? `검색 ${stats.totals.searches} · 결과 ${stats.totals.results} · Queue ${waiting + delayed}`
    : '불러오는 중…';

  return (
    <section className="rounded-2xl border border-ink-100/80 bg-white/75 shadow-soft backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-sand-50/80"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
            Dashboard
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 className="font-display text-xl text-ink-900">통계</h2>
            {!open ? (
              <span className="truncate text-sm text-ink-500">{peek}</span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-ink-400">
          {open ? '접기' : '펼치기'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-ink-100/80 px-5 pb-5 pt-4">
          {!stats ? (
            <p className="text-sm text-ink-500">통계를 불러오는 중…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {tiles.map((t) => (
                  <div
                    key={t.label}
                    className="rounded-xl border border-ink-100/70 bg-sand-50/80 px-3 py-3"
                  >
                    <div className="text-xs text-ink-500">{t.label}</div>
                    <div className="mt-1 font-display text-2xl tabular-nums text-ink-900">
                      {t.value}
                    </div>
                    {t.hint ? (
                      <div className="mt-0.5 text-[11px] text-ink-400">
                        {t.hint}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-ink-100/80 pt-4">
                <h3 className="text-sm font-medium text-ink-800">사이트별 결과</h3>
                {stats.bySite.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-500">
                    아직 저장된 결과가 없습니다.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {stats.bySite.map((row) => (
                      <div
                        key={row.siteCode}
                        className="min-w-[120px] rounded-xl border border-ink-100/70 bg-white px-4 py-3"
                      >
                        <div className="text-sm text-ink-600">
                          {siteLabel(row.siteCode)}
                        </div>
                        <div className="mt-1 font-display text-2xl tabular-nums text-ink-900">
                          {row.count}
                          <span className="ml-1 text-sm font-sans text-ink-400">
                            건
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {stats.topKeywords.length > 0 ? (
                <div className="mt-5 border-t border-ink-100/80 pt-4">
                  <h3 className="text-sm font-medium text-ink-800">인기 키워드</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stats.topKeywords.map((k) => (
                      <span
                        key={k.keyword}
                        className="rounded-lg border border-ink-100 bg-sand-50 px-3 py-1.5 text-sm text-ink-700"
                      >
                        {k.keyword}
                        <span className="ml-2 text-ink-300">{k.searchCount}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
