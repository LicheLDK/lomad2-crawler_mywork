import { useMemo } from 'react';
import type { StatsOverview } from '../types';
import { Skeleton } from './ui/skeleton';
import {
  MiniSparkline,
  TrendDeltaBadge,
  dayOverDayDelta,
} from './Sparkline';

/**
 * Dashboard 하단 Summary — 상세 통계는 Analytics로 이동
 */
export function DashboardSummary({ stats }: { stats: StatsOverview | null }) {
  const waiting = stats?.queue?.waiting ?? 0;
  const active = stats?.queue?.active ?? 0;
  const delayed = stats?.queue?.delayed ?? 0;

  const searchSeries = useMemo(
    () => stats?.searchTrend?.map((r) => r.searches) ?? [],
    [stats?.searchTrend],
  );
  const resultSeries = useMemo(
    () => stats?.searchTrend?.map((r) => r.results) ?? [],
    [stats?.searchTrend],
  );
  const searchDelta = useMemo(
    () => dayOverDayDelta(searchSeries),
    [searchSeries],
  );
  const resultDelta = useMemo(
    () => dayOverDayDelta(resultSeries),
    [resultSeries],
  );

  const tiles = stats
    ? [
        {
          label: '검색',
          value: stats.totals.searches,
          sparkline: searchSeries,
          delta: searchDelta,
        },
        {
          label: '결과',
          value: stats.totals.results,
          sparkline: resultSeries,
          delta: resultDelta,
        },
        {
          label: '오늘',
          value: stats.last24h.results,
          hint: `검색 ${stats.last24h.searches}`,
          sparkline: resultSeries,
          delta: resultDelta,
        },
        {
          label: 'Queue',
          value: waiting + delayed,
          hint: active ? `active ${active}` : undefined,
        },
      ]
    : [];

  return (
    <section className="rounded-2xl border border-ink-100/80 bg-white/75 shadow-1 backdrop-blur transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-2">
      <div className="px-5 py-3.5">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
          Dashboard
        </p>
        <h2 className="font-display text-xl text-ink-900">Summary</h2>
      </div>

      <div className="border-t border-ink-100/80 px-5 pb-5 pt-4">
        {!stats ? (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            aria-busy="true"
            aria-label="통계 불러오는 중"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-ink-100/70 bg-sand-50/80 px-3 py-3"
              >
                <Skeleton className="h-3 w-10" />
                <Skeleton className="mt-2 h-7 w-16" />
                <Skeleton className="mt-1.5 h-2.5 w-12" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <div
                key={t.label}
                className="rounded-xl border border-ink-100/70 bg-sand-50/80 px-3 py-3 shadow-1 transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-ink-500">{t.label}</div>
                  <MiniSparkline values={t.sparkline} />
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="font-display text-2xl tabular-nums text-ink-900">
                    {t.value}
                  </div>
                  <TrendDeltaBadge delta={t.delta ?? null} />
                </div>
                {t.hint ? (
                  <div className="mt-0.5 text-[11px] text-ink-400">{t.hint}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
