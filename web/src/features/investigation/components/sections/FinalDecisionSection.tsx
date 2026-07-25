import { useState } from 'react';
import { Ban, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import type { FinalDecision, InvestigationCase } from '../../types';
import { applyFinalDecision } from '../../lib/store';
import { isInvestigationLocked } from '../../lib/workflow';
import { formatTime } from '../../../../lib/format';
import { toast } from '../../../../components/Toast';
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
    label: '??? ??',
    description: '?? ??? ?? ???? ?????.',
    Icon: ShieldAlert,
    tone: 'rose',
  },
  {
    value: 'further_investigation',
    label: '?? ??',
    description: '?? ??? ???? ? Case? ?? ?????.',
    Icon: Search,
    tone: 'amber',
  },
  {
    value: 'false_positive',
    label: '??',
    description: 'AI/?? ??? ???? ?????.',
    Icon: Ban,
    tone: 'ink',
  },
  {
    value: 'excluded',
    label: '??',
    description: '?? ???? ?????.',
    Icon: CheckCircle2,
    tone: 'teal',
  },
];

export function finalDecisionLabel(value: FinalDecision | null | undefined) {
  return (
    FINAL_DECISION_OPTIONS.find((o) => o.value === value)?.label ?? value ?? '?'
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
  const [pending, setPending] = useState<FinalDecision | null>(null);
  const pendingOption = FINAL_DECISION_OPTIONS.find((o) => o.value === pending);

  function confirm() {
    if (!pending) return;
    const updated = applyFinalDecision(row.id, pending);
    setPending(null);
    if (!updated) {
      toast('?? ??? ??? ? ????.');
      return;
    }
    toast(
      `?? ??: ${finalDecisionLabel(pending)} · Completed? ???????.`,
    );
  }

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
              ??? · {formatTime(row.decidedAt)}
            </p>
            <p className="pt-1 text-xs text-ink-400">
              ?? ?? ? Completed ???? ??? ? ????.
            </p>
          </div>
        ) : locked ? (
          <p className="text-sm text-ink-500">
            Completed / Archived ????? ?? ??? ??? ? ????.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FINAL_DECISION_OPTIONS.map((opt) => {
              const Icon = opt.Icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPending(opt.value)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${BTN[opt.tone]}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending != null}
        title="?? ?? ??"
        description={
          pendingOption
            ? `?${pendingOption.label}??? ?????. Case? Completed ??? ???? Timeline? ?????. ${pendingOption.description}`
            : undefined
        }
        confirmLabel="?? ??"
        cancelLabel="??"
        tone={
          pending === 'resale_confirmed'
            ? 'danger'
            : pending === 'excluded'
              ? 'teal'
              : 'default'
        }
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      />
    </section>
  );
}
