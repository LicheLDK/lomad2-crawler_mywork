import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StatsOverview } from '../types';
import { siteLabel } from '../lib/format';

const TEAL = '#0f766e';
const INK = '#141c2e';
const MUTED = '#94a3b8';
const SAND = '#efeae2';

function Panel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-100/80 bg-white/75 p-4 shadow-soft backdrop-blur sm:p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
        {eyebrow}
      </p>
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function formatDay(day: string) {
  const [, m, d] = day.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function AnalyticsPage({ stats }: { stats: StatsOverview | null }) {
  const siteData = useMemo(
    () =>
      (stats?.bySite ?? []).map((row) => ({
        name: siteLabel(row.siteCode),
        count: row.count,
      })),
    [stats],
  );

  const keywordData = useMemo(
    () =>
      (stats?.topKeywords ?? []).map((k) => ({
        name:
          k.keyword.length > 12 ? `${k.keyword.slice(0, 12)}…` : k.keyword,
        full: k.keyword,
        count: k.searchCount,
      })),
    [stats],
  );

  const trendData = useMemo(
    () =>
      (stats?.searchTrend ?? []).map((row) => ({
        ...row,
        label: formatDay(row.day),
      })),
    [stats],
  );

  if (!stats) {
    return (
      <div className="animate-fadeUp rounded-2xl border border-ink-100/80 bg-white/60 px-6 py-16 text-center shadow-soft">
        <p className="text-sm text-ink-500">Analytics를 불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeUp space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
          Analytics
        </p>
        <h2 className="font-display text-2xl text-ink-900">운영 통계</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="검색 수" value={stats.totals.searches} />
        <MetricCard label="검색 결과" value={stats.totals.results} />
        <MetricCard
          label="오늘 검색"
          value={stats.last24h.searches}
          hint="최근 24시간"
        />
        <MetricCard
          label="오늘 결과"
          value={stats.last24h.results}
          hint="최근 24시간"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="Sites" title="사이트별 통계">
          {siteData.length === 0 ? (
            <p className="text-sm text-ink-500">아직 저장된 결과가 없습니다.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={siteData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={SAND} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: MUTED, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: MUTED, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(15, 118, 110, 0.06)' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" name="결과" fill={TEAL} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel eyebrow="Keywords" title="인기 키워드">
          {keywordData.length === 0 ? (
            <p className="text-sm text-ink-500">인기 키워드가 없습니다.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={keywordData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke={SAND} strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: MUTED, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fill: INK, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [Number(value ?? 0), '검색']}
                    labelFormatter={(_, payload) =>
                      (payload?.[0]?.payload as { full?: string } | undefined)
                        ?.full ?? ''
                    }
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" name="검색" fill={INK} radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel eyebrow="Trend" title="검색 추세">
        {trendData.length === 0 ? (
          <p className="text-sm text-ink-500">추세 데이터가 없습니다.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={SAND} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: MUTED, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: MUTED, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 13,
                  }}
                  labelFormatter={(_, payload) =>
                    (payload?.[0]?.payload as { day?: string })?.day ?? ''
                  }
                />
                <Line
                  type="monotone"
                  dataKey="searches"
                  name="검색"
                  stroke={TEAL}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="results"
                  name="결과"
                  stroke={INK}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-[11px] text-ink-400">최근 14일 · 실선 검색 / 점선 결과</p>
      </Panel>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-100/80 bg-white/75 px-4 py-4 shadow-soft backdrop-blur">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 font-display text-3xl tabular-nums text-ink-900">
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-ink-400">{hint}</div> : null}
    </div>
  );
}
