import { useState } from 'react';
import { Ban, CheckCircle2, Lock, Search, ShieldAlert } from 'lucide-react';
import type { FinalDecision, InvestigationCase } from '../../types';
import { WRITE_API_PENDING_HINT } from '../../types';
import { isInvestigationLocked } from '../../lib/workflow';
import { formatTime } from '../../../../lib/format';
import { Badge } from '../../../../components/ui/badge';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';

export const FINAL_DECISION_OPTIONS: {
  value: FinalDecision;
  label: string;
  description: string;
  Icon: typeof CheckCircle2;
  tone: 'teal' | 'amber' | 'rose' | 'ink';
}[] = [
  {
    value: 'resale_confirmed',
    label: '재판매 확인',
    description: '무단 재판매로 판정합니다.',
    Icon: ShieldAlert,
    tone: 'rose',
  },
  {
    value: 'further_investigation',
    label: '추가 조사',
    description: '추가 조사가 필요하나 Case는 완료 처리합니다.',
    Icon: Search,
    tone: 'amber',
  },
  {
    value: 'false_positive',
    label: '오탐',
    description: 'AI/검색 결과가 오탐으로 판정합니다.',
    Icon: Ban,
    tone: 'ink',
  },
  {
    value: 'excluded',
    label: '제외',
    description: '조사 대상에서 제외합니다.',
    Icon: CheckCircle2,
    tone: 'teal',
  },
];

export function finalDecisionLabel(value: FinalDecision | null | undefined) {
  return (
    FINAL_DECISION_OPTIONS.find((o) => o.value === value)?.label ?? value ?? '—'
  );
}

const BTN: Record<(typeof FINAL_DECISION_OPTIONS)[number]['tone'], string> = {
  rose: 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
  ink: 'border-ink-200 bg-sand-50 text-ink-800 hover:bg-sand-100',
  teal: 'border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100',
};

export function InvestigationFinalDecisionPanel({
  row,
}: {
  row: InvestigationCase;
}) {
  const locked = isInvestigationLocked(row.status);
  const writesDisabled = true; // D-1: write API pending
  const [pending, setPending] = useState<FinalDecision | null>(null);
  const pendingOption = FINAL_DECISION_OPTIONS.find((o) => o.value === pending);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
          Final Decision
        </h3>
        {row.finalDecision ? (
          <Badge variant="teal">{finalDecisionLabel(row.finalDecision)}</Badge>
        ) : null}
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-4">
        {locked && row.finalDecision ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-ink-900">
              {finalDecisionLabel(row.finalDecision)}
            </p>
            <p className="text-xs text-ink-500">
              판정일 · {formatTime(row.decidedAt)}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FINAL_DECISION_OPTIONS.map((opt) => {
              const Icon = opt.Icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={writesDisabled || locked}
                  onClick={() => {
                    if (!writesDisabled && !locked) setPending(opt.value);
                  }}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BTN[opt.tone]}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-500">
          <Lock className="h-3.5 w-3.5" />
          {WRITE_API_PENDING_HINT} — 최종 판정은 저장되지 않습니다
        </p>
      </div>

      <ConfirmDialog
        open={pending != null}
        title="최종 판정 확인"
        description={
          pendingOption
            ? `'${pendingOption.label}' — ${WRITE_API_PENDING_HINT}`
            : undefined
        }
        confirmLabel="확인"
        cancelLabel="취소"
        tone={
          pending === 'resale_confirmed'
            ? 'danger'
            : pending === 'excluded'
              ? 'teal'
              : 'default'
        }
        onCancel={() => setPending(null)}
        onConfirm={() => setPending(null)}
      />
    </section>
  );
}
