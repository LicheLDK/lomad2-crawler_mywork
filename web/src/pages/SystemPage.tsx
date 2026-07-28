import { useEffect } from 'react';
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
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { HealthPayload } from '../types';

type ServiceStatus = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'READY';

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

function buildCards(health: HealthPayload | null): StatusCardModel[] {
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
    {
      id: 'ai',
      label: 'AI Engine',
      icon: Bot,
      status: apiOnline ? 'ONLINE' : 'OFFLINE',
      detail: apiOnline
        ? 'API 경유 AI 기능 가용 (상세는 Prompt/Rules)'
        : 'API 연결 필요',
    },
    {
      id: 'prompt',
      label: 'Prompt',
      icon: FileText,
      status: 'READY',
      detail: '메뉴만 추가 · Prompt Manager UI 준비중',
    },
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
  const cards = buildCards(health);

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
    </div>
  );
}
