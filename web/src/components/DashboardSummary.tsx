import type { StatsOverview } from '../types';

/**
 * Dashboard 하단 Summary — 상세 통계는 Analytics로 이동
 */
export function DashboardSummary({ stats }: { stats: StatsOverview | null }) {
  const waiting = stats?.queue?.waiting ?? 0;
  const active = stats?.queue?.active ?? 0;
  const delayed = stats?.queue?.delayed ?? 0;

  const tiles = stats
    ? [
        { label: '검색', value: stats.totals.searches },
        { label: '결과', value: stats.totals.results },
        {
          label: '오늘',
          value: stats.last24h.results,
          hint: `검색 ${stats.last24h.searches}`,
        },
        {
          label: 'Queue',
          value: waiting + delayed,
          hint: active ? `active ${active}` : undefined,
        },
      ]
    : [];

  return (
    <section className="rounded-2xl border border-ink-100/80 bg-white/75 shadow-soft backdrop-blur">
      <div className="px-5 py-3.5">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
          Dashboard
        </p>
        <h2 className="font-display text-xl text-ink-900">Summary</h2>
      </div>

      <div className="border-t border-ink-100/80 px-5 pb-5 pt-4">
        {!stats ? (
          <p className="text-sm text-ink-500">통계를 불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
