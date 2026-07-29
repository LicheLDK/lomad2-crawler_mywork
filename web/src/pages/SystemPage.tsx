import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  Cpu,
  Database,
  FileText,
  HardDrive,
  Layers,
  Radio,
  CalendarClock,
  Network,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api, formatApiError } from '../api';
import type {
  AiPromptTreeNode,
  AiRuleDefinition,
  AiUsageSummary,
  FailedQueueJobItem,
  HealthPayload,
} from '../types';

type ServiceStatus = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'READY';

type AiUsageLoadState = 'loading' | 'ok' | 'unavailable';

type PromptLoadState = 'loading' | 'ok' | 'unavailable';

type RulesLoadState = 'loading' | 'ok' | 'unavailable';

type StatusCardModel = {
  id: string;
  label: string;
  icon: LucideIcon;
  status: ServiceStatus;
  detail: string;
};

function statusTone(status: ServiceStatus) {
  switch (status) {
    case 'ONLINE':
      return {
        badge: 'bg-teal-50 text-teal-700 ring-teal-200/80',
        card: 'border-teal-600/25 bg-teal-50/40',
        icon: 'text-teal-700',
        dot: 'bg-teal-600',
      };
    case 'READY':
      return {
        badge: 'bg-sand-100 text-ink-600 ring-ink-100',
        card: 'border-ink-100/80 bg-white/70',
        icon: 'text-ink-500',
        dot: 'bg-ink-300',
      };
    case 'WARNING':
      return {
        badge: 'bg-amber-50 text-amber-800 ring-amber-200/80',
        card: 'border-amber-500/30 bg-amber-50/50',
        icon: 'text-amber-700',
        dot: 'bg-amber-500',
      };
    case 'OFFLINE':
    default:
      return {
        badge: 'bg-rose-50 text-rose-800 ring-rose-200/80',
        card: 'border-rose-400/30 bg-rose-50/50',
        icon: 'text-rose-700',
        dot: 'bg-rose-500',
      };
  }
}

function fromUp(ok: boolean | undefined): ServiceStatus {
  if (ok === true) return 'ONLINE';
  return 'OFFLINE';
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRuleCondition(
  field: string,
  operator: string,
  value: number,
): string {
  const opMap: Record<string, string> = {
    gte: '≥',
    lte: '≤',
    gt: '>',
    lt: '<',
    eq: '=',
  };
  return `${field} ${opMap[operator] ?? operator} ${value}`;
}

function PromptRulesPanel({
  highlight,
  promptLoad,
  promptTree,
  rulesLoad,
  activeRules,
  createThreshold,
}: {
  highlight?: boolean;
  promptLoad: PromptLoadState;
  promptTree: AiPromptTreeNode[] | null;
  rulesLoad: RulesLoadState;
  activeRules: AiRuleDefinition[] | null;
  createThreshold: number | null;
}) {
  const loading = promptLoad === 'loading' || rulesLoad === 'loading';
  const promptFailed = promptLoad === 'unavailable';
  const rulesFailed = rulesLoad === 'unavailable';

  return (
    <section
      id="section-prompt-detail"
      className={`scroll-mt-4 rounded-2xl border bg-white/80 px-4 py-4 shadow-soft backdrop-blur ${
        highlight ? 'border-teal-600/30 ring-2 ring-teal-600/40' : 'border-ink-100/80'
      }`}
    >
      <div>
        <h3 className="text-sm font-medium text-ink-900">Prompt &amp; Rules</h3>
        <p className="mt-0.5 text-[11px] text-ink-500">
          GET /ai/prompts · /ai/rules/active · /ai/rules/create-threshold (읽기 전용)
        </p>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-ink-500">불러오는 중…</p>
      ) : null}

      {!loading && promptFailed && rulesFailed ? (
        <p className="mt-4 text-sm text-ink-500">
          Prompt·Rules를 불러오지 못했습니다. API 키와 서버 연결을 확인하세요.
        </p>
      ) : null}

      {!loading && !promptFailed ? (
        <div className="mt-4">
          <h4 className="text-xs font-medium uppercase tracking-wide text-ink-500">
            Prompt Tree
          </h4>
          {promptTree && promptTree.length > 0 ? (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500">
                    <th className="px-2 py-2 font-medium">key</th>
                    <th className="px-2 py-2 font-medium">이름</th>
                    <th className="px-2 py-2 font-medium">활성 버전</th>
                    <th className="px-2 py-2 font-medium">버전 수</th>
                    <th className="px-2 py-2 font-medium">source</th>
                  </tr>
                </thead>
                <tbody>
                  {promptTree.map((node) => (
                    <tr
                      key={node.key}
                      className="border-b border-ink-50 align-top last:border-0"
                    >
                      <td className="px-2 py-2 font-mono text-[11px] text-ink-900">
                        {node.key}
                      </td>
                      <td className="px-2 py-2 text-ink-700">{node.name}</td>
                      <td className="px-2 py-2 text-ink-600">
                        {node.activeVersion != null ? `v${node.activeVersion}` : '—'}
                      </td>
                      <td className="px-2 py-2 text-ink-600">
                        {node.versions.length}
                      </td>
                      <td className="px-2 py-2 text-ink-600">{node.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-500">등록된 prompt가 없습니다.</p>
          )}
        </div>
      ) : null}

      {!loading && !rulesFailed ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-ink-500">
              AI Rules
            </h4>
            {createThreshold != null ? (
              <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800 ring-1 ring-teal-200/80">
                create_investigation 임계 {createThreshold}
              </span>
            ) : null}
            {activeRules ? (
              <span className="text-[11px] text-ink-500">
                활성 {activeRules.length}건
              </span>
            ) : null}
          </div>
          {activeRules && activeRules.length > 0 ? (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500">
                    <th className="px-2 py-2 font-medium">code</th>
                    <th className="px-2 py-2 font-medium">이름</th>
                    <th className="px-2 py-2 font-medium">조건</th>
                    <th className="px-2 py-2 font-medium">action</th>
                    <th className="px-2 py-2 font-medium">priority</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRules.map((rule) => (
                    <tr
                      key={rule.code}
                      className="border-b border-ink-50 align-top last:border-0"
                    >
                      <td className="px-2 py-2 font-mono text-[11px] text-ink-900">
                        {rule.code}
                      </td>
                      <td className="px-2 py-2 text-ink-700">{rule.name}</td>
                      <td className="px-2 py-2 text-ink-600">
                        {formatRuleCondition(rule.field, rule.operator, rule.value)}
                      </td>
                      <td className="px-2 py-2 text-ink-600">{rule.action}</td>
                      <td className="px-2 py-2 text-ink-600">
                        {rule.priority ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-500">활성 rule이 없습니다.</p>
          )}
        </div>
      ) : null}

      {!loading && rulesFailed && !promptFailed ? (
        <p className="mt-4 text-sm text-ink-500">Rules를 불러오지 못했습니다.</p>
      ) : null}
    </section>
  );
}

function QueueFailedPanel({
  highlight,
  failedCount,
  onCountsChange,
}: {
  highlight?: boolean;
  failedCount: number;
  onCountsChange?: () => void;
}) {
  const [items, setItems] = useState<FailedQueueJobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setError(null);
    try {
      const res = await api.listFailedQueueJobs(50);
      setItems(res.items);
      setTotal(res.total);
      setLoadState('ok');
    } catch (e) {
      setItems([]);
      setTotal(0);
      setLoadState('error');
      setError(formatApiError(e, 'DLQ 목록을 불러오지 못했습니다.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, failedCount]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    setError(null);
    try {
      await api.retryFailedQueueJob(id);
      await load();
      onCountsChange?.();
    } catch (e) {
      setError(formatApiError(e, '재시도에 실패했습니다.'));
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section
      id="section-queue-failed"
      className={`scroll-mt-4 rounded-2xl border bg-white/80 px-4 py-4 shadow-soft backdrop-blur ${
        highlight ? 'border-amber-500/30 ring-2 ring-teal-600/40' : 'border-ink-100/80'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink-900">Failed / DLQ</h3>
          <p className="mt-0.5 text-[11px] text-ink-500">
            재시도 소진된 crawl job · 총 {total.toLocaleString()}건
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loadState === 'loading'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-100 bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loadState === 'loading' ? 'animate-spin' : ''}`}
          />
          새로고침
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      ) : null}

      {loadState === 'loading' && items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">목록 불러오는 중…</p>
      ) : null}

      {loadState === 'ok' && items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">
          DLQ에 보관된 실패 job이 없습니다.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500">
                <th className="px-2 py-2 font-medium">키워드</th>
                <th className="px-2 py-2 font-medium">searchHistory</th>
                <th className="px-2 py-2 font-medium">실패 시각</th>
                <th className="px-2 py-2 font-medium">시도</th>
                <th className="px-2 py-2 font-medium">사유</th>
                <th className="px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-ink-50 align-top last:border-0"
                >
                  <td className="px-2 py-2 font-medium text-ink-900">
                    {item.keyword}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-ink-600">
                    {item.searchHistoryId.slice(0, 8)}…
                  </td>
                  <td className="px-2 py-2 text-ink-600">
                    {formatWhen(item.failedAt)}
                  </td>
                  <td className="px-2 py-2 text-ink-600">
                    {item.attemptsMade}
                  </td>
                  <td
                    className="max-w-xs px-2 py-2 text-ink-600"
                    title={item.failedReason}
                  >
                    <span className="line-clamp-2">{item.failedReason}</span>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => void handleRetry(item.id)}
                      disabled={retryingId === item.id}
                      className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {retryingId === item.id ? '재시도…' : '재시도'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function aiEngineCard(
  apiOnline: boolean,
  aiLoad: AiUsageLoadState,
  summary: AiUsageSummary | null,
): StatusCardModel {
  if (aiLoad === 'ok' && summary) {
    const failHint =
      summary.today.failureCount > 0
        ? ` · 실패 ${summary.today.failureCount}`
        : '';
    return {
      id: 'ai',
      label: 'AI Engine',
      icon: Bot,
      status: summary.today.failureCount > 0 ? 'WARNING' : 'ONLINE',
      detail: `오늘 ${summary.today.callCount.toLocaleString()}회 · ${formatUsd(summary.today.costUsd)}${failHint} · 월간 ${formatUsd(summary.month.costUsd)} (${summary.month.yearMonth})`,
    };
  }

  if (aiLoad === 'unavailable') {
    return {
      id: 'ai',
      label: 'AI Engine',
      icon: Bot,
      status: 'WARNING',
      detail: '비활성·키 없음 (usage API 조회 실패)',
    };
  }

  return {
    id: 'ai',
    label: 'AI Engine',
    icon: Bot,
    status: apiOnline ? 'ONLINE' : 'OFFLINE',
    detail: apiOnline ? 'usage 불러오는 중…' : 'API 연결 필요',
  };
}

function promptEngineCard(
  apiOnline: boolean,
  promptLoad: PromptLoadState,
  tree: AiPromptTreeNode[] | null,
  rulesLoad: RulesLoadState,
  rules: AiRuleDefinition[] | null,
  threshold: number | null,
): StatusCardModel {
  if (promptLoad === 'ok' && tree) {
    const activeCount = tree.filter((n) => n.activeVersion != null).length;
    const rulesHint =
      rulesLoad === 'ok' && rules && threshold != null
        ? ` · Rules ${rules.length} · 임계 ${threshold}`
        : '';
    return {
      id: 'prompt',
      label: 'Prompt',
      icon: FileText,
      status:
        activeCount < tree.length && tree.length > 0 ? 'WARNING' : 'ONLINE',
      detail: `${tree.length} keys · 활성 ${activeCount}${rulesHint}`,
    };
  }

  if (promptLoad === 'unavailable') {
    return {
      id: 'prompt',
      label: 'Prompt',
      icon: FileText,
      status: 'WARNING',
      detail: '조회 실패 (API 키 확인)',
    };
  }

  return {
    id: 'prompt',
    label: 'Prompt',
    icon: FileText,
    status: apiOnline ? 'ONLINE' : 'OFFLINE',
    detail: apiOnline ? '불러오는 중…' : 'API 연결 필요',
  };
}

function buildCards(
  health: HealthPayload | null,
  aiLoad: AiUsageLoadState,
  summary: AiUsageSummary | null,
  promptLoad: PromptLoadState,
  promptTree: AiPromptTreeNode[] | null,
  rulesLoad: RulesLoadState,
  activeRules: AiRuleDefinition[] | null,
  createThreshold: number | null,
): StatusCardModel[] {
  const info = health?.info;
  const queue = info?.queue ?? null;
  const waiting = queue?.waiting ?? 0;
  const active = queue?.active ?? 0;
  const delayed = queue?.delayed ?? 0;
  const failed = queue?.failed ?? 0;

  let queueStatus: ServiceStatus = 'OFFLINE';
  let queueDetail = 'Queue에 연결할 수 없습니다.';
  if (queue) {
    if (failed > 0 || delayed > 20) {
      queueStatus = 'WARNING';
      queueDetail = `waiting ${waiting} · active ${active} · delayed ${delayed} · failed ${failed}`;
    } else {
      queueStatus = 'ONLINE';
      queueDetail = `waiting ${waiting} · active ${active} · delayed ${delayed}`;
    }
  }

  let workerStatus: ServiceStatus = 'OFFLINE';
  let workerDetail = 'Worker 상태를 확인할 수 없습니다.';
  if (queue) {
    if (failed > 0) {
      workerStatus = 'WARNING';
      workerDetail = `failed ${failed} · active ${active}`;
    } else if (active > 0) {
      workerStatus = 'ONLINE';
      workerDetail = `처리 중 ${active}건`;
    } else {
      workerStatus = 'ONLINE';
      workerDetail = '대기 중 (idle)';
    }
  }

  const apiOnline = Boolean(health);
  const apiStatus: ServiceStatus =
    apiOnline && health?.status === 'error' ? 'WARNING' : fromUp(apiOnline);

  return [
    {
      id: 'worker',
      label: 'Worker',
      icon: Cpu,
      status: workerStatus,
      detail: workerDetail,
    },
    {
      id: 'queue',
      label: 'Queue',
      icon: Layers,
      status: queueStatus,
      detail: queueDetail,
    },
    {
      id: 'api',
      label: 'API',
      icon: Activity,
      status: apiStatus,
      detail: apiOnline
        ? health?.status === 'error'
          ? '일부 의존성 장애'
          : 'Gateway 응답 정상'
        : 'API에 연결할 수 없습니다.',
    },
    {
      id: 'proxy',
      label: 'Proxy',
      icon: Network,
      status: 'READY',
      detail: '메뉴만 추가 · 프록시 설정 UI 준비중',
    },
    {
      id: 'scheduler',
      label: 'Scheduler',
      icon: CalendarClock,
      status: 'READY',
      detail: '메뉴만 추가 · 스케줄러 UI 준비중',
    },
    aiEngineCard(apiOnline, aiLoad, summary),
    promptEngineCard(
      apiOnline,
      promptLoad,
      promptTree,
      rulesLoad,
      activeRules,
      createThreshold,
    ),
    {
      id: 'redis',
      label: 'Redis',
      icon: Radio,
      status: fromUp(info?.redis?.status === 'up'),
      detail:
        info?.redis?.status === 'up'
          ? '캐시 · 큐 브로커 정상'
          : 'Redis 응답 없음',
    },
    {
      id: 'postgres',
      label: 'Postgres',
      icon: Database,
      status: fromUp(info?.postgres?.status === 'up'),
      detail:
        info?.postgres?.status === 'up'
          ? '데이터베이스 연결 정상'
          : 'Postgres 응답 없음',
    },
    {
      id: 'elastic',
      label: 'Elastic',
      icon: HardDrive,
      status: fromUp(info?.elasticsearch?.status === 'up'),
      detail:
        info?.elasticsearch?.status === 'up'
          ? '검색 인덱스 정상'
          : 'Elasticsearch 응답 없음',
    },
  ];
}

function StatusCard({
  card,
  highlight,
}: {
  card: StatusCardModel;
  highlight?: boolean;
}) {
  const tone = statusTone(card.status);
  const Icon = card.icon;

  return (
    <article
      id={`section-${card.id}`}
      className={`scroll-mt-4 rounded-2xl border px-4 py-4 shadow-soft backdrop-blur transition ${tone.card} ${
        highlight ? 'ring-2 ring-teal-600/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 ring-1 ring-ink-100/70 ${tone.icon}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-medium text-ink-900">{card.label}</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-500">
              {card.detail}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-wide ring-1 ${tone.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {card.status === 'READY' ? 'READY' : card.status}
        </span>
      </div>
    </article>
  );
}

export function SystemPage({ health }: { health: HealthPayload | null }) {
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'worker';
  const [aiSummary, setAiSummary] = useState<AiUsageSummary | null>(null);
  const [aiLoad, setAiLoad] = useState<AiUsageLoadState>('loading');
  const [promptTree, setPromptTree] = useState<AiPromptTreeNode[] | null>(null);
  const [promptLoad, setPromptLoad] = useState<PromptLoadState>('loading');
  const [activeRules, setActiveRules] = useState<AiRuleDefinition[] | null>(
    null,
  );
  const [rulesLoad, setRulesLoad] = useState<RulesLoadState>('loading');
  const [createThreshold, setCreateThreshold] = useState<number | null>(null);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const cards = buildCards(
    health,
    aiLoad,
    aiSummary,
    promptLoad,
    promptTree,
    rulesLoad,
    activeRules,
    createThreshold,
  );
  const failedCount = health?.info?.queue?.failed ?? 0;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const summary = await api.aiUsageSummary();
        if (!cancelled) {
          setAiSummary(summary);
          setAiLoad('ok');
        }
      } catch {
        if (!cancelled) {
          setAiSummary(null);
          setAiLoad('unavailable');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [treeRes, rulesRes, thresholdRes] = await Promise.allSettled([
        api.aiPromptsTree(),
        api.aiRulesActive(),
        api.aiRulesCreateThreshold(),
      ]);
      if (cancelled) return;

      if (treeRes.status === 'fulfilled') {
        setPromptTree(treeRes.value);
        setPromptLoad('ok');
      } else {
        setPromptTree(null);
        setPromptLoad('unavailable');
      }

      if (rulesRes.status === 'fulfilled') {
        setActiveRules(rulesRes.value);
        setRulesLoad('ok');
      } else {
        setActiveRules(null);
        setRulesLoad('unavailable');
      }

      if (thresholdRes.status === 'fulfilled') {
        setCreateThreshold(thresholdRes.value.threshold);
      } else {
        setCreateThreshold(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = document.getElementById(`section-${section}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [section]);

  return (
    <div className="animate-fadeUp space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
          System
        </p>
        <h2 className="font-display text-2xl text-ink-900">운영 관리</h2>
        <p className="mt-1 text-sm text-ink-500">
          Worker · Queue · API · Proxy · Scheduler · AI Engine · Prompt
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <StatusCard
            key={card.id}
            card={card}
            highlight={section === card.id}
          />
        ))}
      </div>

      <QueueFailedPanel
        highlight={section === 'queue'}
        failedCount={failedCount + queueRefreshKey}
        onCountsChange={() => setQueueRefreshKey((n) => n + 1)}
      />

      <PromptRulesPanel
        highlight={section === 'prompt'}
        promptLoad={promptLoad}
        promptTree={promptTree}
        rulesLoad={rulesLoad}
        activeRules={activeRules}
        createThreshold={createThreshold}
      />
    </div>
  );
}
