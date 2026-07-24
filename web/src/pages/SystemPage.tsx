import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Layers,
  Radio,
} from 'lucide-react';
import type { HealthPayload } from '../types';

type ServiceStatus = 'ONLINE' | 'OFFLINE' | 'WARNING';

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
  ];
}

function StatusCard({ card }: { card: StatusCardModel }) {
  const tone = statusTone(card.status);
  const Icon = card.icon;

  return (
    <article
      className={`rounded-2xl border px-4 py-4 shadow-soft backdrop-blur transition ${tone.card}`}
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
          {card.status}
        </span>
      </div>
    </article>
  );
}

export function SystemPage({ health }: { health: HealthPayload | null }) {
  const cards = buildCards(health);

  return (
    <div className="animate-fadeUp space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
          System
        </p>
        <h2 className="font-display text-2xl text-ink-900">인프라 상태</h2>
        <p className="mt-1 text-sm text-ink-500">
          Worker · Queue · Redis · Postgres · Elastic · API
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <StatusCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
