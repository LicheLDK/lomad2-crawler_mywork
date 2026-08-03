import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Activity, Cpu } from 'lucide-react';
import { api } from '../api';
import type { AiUsageToday, HealthPayload, StatsOverview } from '../types';
import type { InvestigationStatsResponse } from '../features/investigation';
import { RecentSearches } from '../components/RecentSearches';
import { DashboardSummary } from '../components/DashboardSummary';
import { CaseSummaryCard } from '../features/investigation';
import { Skeleton } from '../components/ui/skeleton';
import {
  MiniSparkline,
  TrendDeltaBadge,
  dayOverDayDelta,
} from '../components/Sparkline';

/**
 * Dashboard Overview — 요약만. 상세는 각 메뉴에서.
 */
export function OverviewPage({
  stats,
  health,
  aiUsageToday,
  activeId,
  onSelectSearch,
  onDeleteSearch,
  onDuplicateSearch,
  deletingId = null,
}: {
  stats: StatsOverview | null;
  health: HealthPayload | null;
  aiUsageToday: AiUsageToday | null;
  activeId?: string | null;
  onSelectSearch: (id: string) => void;
  onDeleteSearch?: (id: string) => void | Promise<void>;
  onDuplicateSearch?: (item: {
    keyword: string;
    sites?: string[] | null;
  }) => void | Promise<void>;
  deletingId?: string | null;
}) {
  const queue = health?.info?.queue ?? stats?.queue ?? null;
  const workerActive = queue?.active ?? 0;
  const workerFailed = queue?.failed ?? 0;
  const workerLabel =
    workerFailed > 0
      ? `주의 · failed ${workerFailed}`
      : workerActive > 0
        ? `처리 중 ${workerActive}`
        : '대기 중';

  const [invStats, setInvStats] = useState<InvestigationStatsResponse | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.getInvestigationStats();
        if (!cancelled) setInvStats(res);
      } catch {
        if (!cancelled) setInvStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const searchSeries = useMemo(
    () => stats?.searchTrend?.map((r) => r.searches) ?? [],
    [stats?.searchTrend],
  );
  const searchDelta = useMemo(
    () => dayOverDayDelta(searchSeries),
    [searchSeries],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 animate-fadeUp">
      <header className="shrink-0">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
          Dashboard
        </p>
        <h2 className="font-display text-2xl text-ink-900">Overview</h2>
        <p className="mt-1 max-w-xl text-sm text-ink-500">
          오늘 요약과 최근 활동만 표시합니다. 검색·조사·통계는 각 메뉴에서
          진행하세요.
        </p>
      </header>

      <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewTile
          label="오늘 검색"
          value={stats?.last24h.searches ?? '—'}
          hint="최근 24시간"
          to="/search"
          sparkline={searchSeries}
          delta={searchDelta}
        />
        <OverviewTile
          label="오늘 Investigation"
          value={invStats?.last24h ?? '—'}
          hint="최근 24시간 생성 케이스"
          to="/investigation"
        />
        <OverviewTile
          label="오늘 AI 분석"
          value={aiUsageToday?.callCount ?? '—'}
          hint="AI Usage API · 오늘 호출 수"
          to="/analytics?section=ai"
        />
        <div className="rounded-2xl border border-ink-100/80 bg-white/75 px-4 py-3 shadow-1 backdrop-blur transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-2">
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <Cpu className="h-3.5 w-3.5" />
            Worker 상태
          </div>
          {queue == null ? (
            <div className="mt-1 space-y-2" aria-busy="true" aria-label="Worker 상태 확인 중">
              <Skeleton className="h-6 w-28" />
            </div>
          ) : (
            <p className="mt-1 font-display text-xl text-ink-900">{workerLabel}</p>
          )}
          <Link
            to="/system?section=worker"
            className="mt-2 inline-flex items-center gap-1 text-xs text-teal-800 hover:underline"
          >
            System
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <DashboardSummary stats={stats} />

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-h-0">
          <RecentSearches
            stats={stats}
            activeId={activeId}
            onSelectSearch={onSelectSearch}
            onDeleteSearch={onDeleteSearch}
            onDuplicateSearch={onDuplicateSearch}
            deletingId={deletingId}
          />
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain">
          <CaseSummaryCard />
          <section className="rounded-2xl border border-ink-100/80 bg-white/75 px-5 py-4 shadow-1 backdrop-blur transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-ink-500">
              <Activity className="h-3.5 w-3.5" />
              Quick links
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <QuickLink to="/search" label="상품 검색" />
              <QuickLink to="/rental" label="주문 연동" />
              <QuickLink to="/investigation?status=Open" label="조사" />
              <QuickLink to="/analytics" label="분석" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function OverviewTile({
  label,
  value,
  hint,
  to,
  sparkline,
  delta,
}: {
  label: string;
  value: number | string;
  hint?: string;
  to: string;
  sparkline?: number[];
  delta?: ReturnType<typeof dayOverDayDelta>;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-ink-100/80 bg-white/75 px-4 py-3 shadow-1 backdrop-blur transition-[box-shadow,transform,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-teal-600/30 hover:shadow-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-ink-500">{label}</p>
        <MiniSparkline values={sparkline} />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <p className="font-display text-2xl tabular-nums text-ink-900">
          {value}
        </p>
        <TrendDeltaBadge delta={delta ?? null} />
      </div>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p> : null}
    </Link>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-lg border border-ink-100 bg-sand-50/80 px-3 py-1.5 text-sm text-ink-800 transition hover:border-teal-600/40 hover:text-teal-900"
    >
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}
