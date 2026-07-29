import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { api } from '../api';
import type { AiUsageSummary, StatsOverview } from '../types';
import {
  INVESTIGATION_STATUSES,
  type InvestigationStatsResponse,
} from '../features/investigation';
import { siteLabel, statusLabel } from '../lib/format';

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

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatLatencyMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatSuccessRate(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

export function AnalyticsPage({ stats }: { stats: StatsOverview | null }) {
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'search';
  const [invStats, setInvStats] = useState<InvestigationStatsResponse | null>(
    null,
  );
  const [invStatsLoading, setInvStatsLoading] = useState(true);
  const [invStatsError, setInvStatsError] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiUsageSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  useEffect(() => {
    const id =
      section === 'sites'
        ? 'section-sites'
        : section === 'ai'
          ? 'section-ai'
          : section === 'investigation'
            ? 'section-investigation'
            : 'section-search';
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.getInvestigationStats();
        if (!cancelled) {
          setInvStats(res);
          setInvStatsError(false);
        }
      } catch {
        if (!cancelled) {
          setInvStats(null);
          setInvStatsError(true);
        }
      } finally {
        if (!cancelled) setInvStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const summary = await api.aiUsageSummary();
        if (!cancelled) {
          setAiSummary(summary);
          setAiUnavailable(false);
        }
      } catch {
        if (!cancelled) {
          setAiSummary(null);
          setAiUnavailable(true);
        }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const siteData = useMemo(
    () =>
      (stats?.bySite ?? []).map((row) => ({
        name: siteLabel(row.siteCode),
        count: row.count,
      })),
    [stats],
  );

  const siteMetricsRows = stats?.siteMetrics?.sites ?? [];
  const siteMetricsHours = stats?.siteMetrics?.hours ?? 24;
  const hasSiteMetrics = siteMetricsRows.length > 0;

  /** SearchHistory 상태 분포 — GET /stats → byStatus */
  const searchStatusData = useMemo(
    () =>
      (stats?.byStatus ?? []).map((row) => ({
        name: statusLabel(row.status),
        status: row.status,
        count: row.count,
      })),
    [stats],
  );

  const searchStatusTotal = useMemo(
    () => searchStatusData.reduce((sum, row) => sum + row.count, 0),
    [searchStatusData],
  );

  /** Investigation Case 상태 분포 — GET /investigations/stats → byStatus */
  const invStatusData = useMemo(
    () =>
      INVESTIGATION_STATUSES.map((status) => ({
        name: status,
        status,
        count: invStats?.byStatus?.[status] ?? 0,
      })),
    [invStats],
  );

  const invStatusTotal = useMemo(
    () => invStatusData.reduce((sum, row) => sum + row.count, 0),
    [invStatusData],
  );

  const providerData = useMemo(
    () =>
      (aiSummary?.byProvider ?? []).map((row) => ({
        name: row.provider,
        calls: row.callCount,
        cost: row.costUsd,
      })),
    [aiSummary],
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

  const highlight = (id: string) =>
    section === id ? 'ring-2 ring-teal-600/40' : '';

  return (
    <div className="animate-fadeUp space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
          Analytics
        </p>
        <h2 className="font-display text-2xl text-ink-900">운영 통계</h2>
        <p className="mt-1 text-sm text-ink-500">
          Dashboard는 요약만 · 상세는 이 화면에서 조회합니다.
        </p>
      </div>

      <div
        id="section-search"
        className={`scroll-mt-4 space-y-5 rounded-2xl ${highlight('search')}`}
      >
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

        <Panel eyebrow="Search · byStatus" title="검색 상태 분포">
          <p className="mb-3 text-sm text-ink-500">
            SearchHistory 상태 · GET /stats → byStatus
          </p>
          {searchStatusTotal === 0 ? (
            <p className="text-sm text-ink-500">
              표시할 검색 상태 데이터가 없습니다.
            </p>
          ) : (
            <StatusBarChart data={searchStatusData} barFill={TEAL} />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div
          id="section-sites"
          className={`scroll-mt-4 rounded-2xl ${highlight('sites')}`}
        >
          <Panel eyebrow="Sites" title="사이트별 통계">
            <p className="mb-3 text-sm text-ink-500">
              저장된 결과 · GET /stats → bySite
            </p>
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

            <div className="mt-6 border-t border-ink-100/80 pt-5">
              <p className="mb-3 text-sm text-ink-500">
                크롤 시도 지표 · GET /stats → siteMetrics · 최근 {siteMetricsHours}
                시간
              </p>
              {!hasSiteMetrics ? (
                <p className="text-sm text-ink-500">아직 시도 기록 없음</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-100/80 text-xs uppercase tracking-wide text-ink-500">
                        <th className="pb-2 pr-3 font-medium">사이트</th>
                        <th className="pb-2 pr-3 font-medium">시도</th>
                        <th className="pb-2 pr-3 font-medium">성공률</th>
                        <th className="pb-2 pr-3 font-medium">실패</th>
                        <th className="pb-2 pr-3 font-medium">평균 지연</th>
                        <th className="pb-2 font-medium">p95 지연</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siteMetricsRows.map((row) => (
                        <tr
                          key={row.siteCode}
                          className="border-b border-ink-50 last:border-0"
                        >
                          <td className="py-2.5 pr-3 font-medium text-ink-900">
                            {siteLabel(row.siteCode)}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums text-ink-700">
                            {row.totalAttempts.toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums text-ink-700">
                            {formatSuccessRate(row.successRate)}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums text-ink-700">
                            {row.failCount.toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums text-ink-700">
                            {formatLatencyMs(row.avgLatencyMs)}
                          </td>
                          <td className="py-2.5 tabular-nums text-ink-700">
                            {formatLatencyMs(row.p95LatencyMs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div
          id="section-ai"
          className={`scroll-mt-4 rounded-2xl ${highlight('ai')}`}
        >
          <Panel eyebrow="AI · usage" title="AI 사용량 · 비용">
            <p className="mb-3 text-sm text-ink-500">
              GET /ai/usage/summary · by-provider
              {aiSummary?.month.yearMonth
                ? ` · ${aiSummary.month.yearMonth}`
                : ''}
            </p>
            {aiLoading ? (
              <p className="text-sm text-ink-500">AI usage를 불러오는 중…</p>
            ) : aiUnavailable ? (
              <p className="text-sm text-ink-500">
                비활성·키 없음 — AI usage API를 조회하지 못했습니다.
              </p>
            ) : aiSummary == null ? (
              <p className="text-sm text-ink-500">표시할 AI usage 데이터가 없습니다.</p>
            ) : (
              <>
                <div className="mb-4 grid gap-2 sm:grid-cols-2">
                  <MetricCard
                    label="오늘 호출"
                    value={aiSummary.today.callCount}
                    hint={`${formatUsd(aiSummary.today.costUsd)} · ${aiSummary.today.date}`}
                  />
                  <MetricCard
                    label="월간 호출"
                    value={aiSummary.month.callCount}
                    hint={`${formatUsd(aiSummary.month.costUsd)} · ${aiSummary.month.yearMonth}`}
                  />
                </div>
                {providerData.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    이번 달 Provider별 사용 기록이 없습니다.
                  </p>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={providerData}
                        layout="vertical"
                        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke={SAND}
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
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
                          formatter={(value, name) => {
                            const n = Number(value ?? 0);
                            if (name === 'cost') {
                              return [formatUsd(n), '비용'];
                            }
                            return [n, '호출'];
                          }}
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                            fontSize: 13,
                          }}
                        />
                        <Bar
                          dataKey="calls"
                          name="calls"
                          fill={INK}
                          radius={[0, 8, 8, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-ink-400">
                  Provider별 호출 수 · 오늘 실패 {aiSummary.today.failureCount}건
                  · 평균 응답 {aiSummary.today.avgResponseTimeMs}ms
                </p>
              </>
            )}
          </Panel>
        </div>
      </div>

      <div
        id="section-investigation"
        className={`scroll-mt-4 rounded-2xl ${highlight('investigation')}`}
      >
        <Panel eyebrow="Investigation · byStatus" title="Investigation 상태 분포">
          <p className="mb-3 text-sm text-ink-500">
            Investigation Case 상태 · GET /investigations/stats → byStatus
            {invStats != null ? (
              <>
                {' '}
                · 최근 24시간 생성 {invStats.last24h.toLocaleString()}건
              </>
            ) : null}
          </p>
          {invStatsLoading ? (
            <p className="text-sm text-ink-500">Investigation 통계를 불러오는 중…</p>
          ) : invStatsError ? (
            <p className="text-sm text-ink-500">
              Investigation 상태 분포를 불러오지 못했습니다.
            </p>
          ) : invStatusTotal === 0 ? (
            <p className="text-sm text-ink-500">
              표시할 Investigation 케이스 상태 데이터가 없습니다.
            </p>
          ) : (
            <StatusBarChart data={invStatusData} barFill={INK} />
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

function StatusBarChart({
  data,
  barFill,
}: {
  data: { name: string; count: number }[];
  barFill: string;
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          <Bar dataKey="count" name="건수" fill={barFill} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
