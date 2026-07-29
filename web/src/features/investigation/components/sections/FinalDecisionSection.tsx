import { useState } from 'react';
import type { FinalDecision, InvestigationCase } from '../../types';
import { isInvestigationLocked } from '../../lib/workflow';
import { useInvestigation } from '../../useInvestigation';
import { formatApiError } from '../../../../api';
import { formatTime } from '../../../../lib/format';
import { Badge } from '../../../../components/ui/badge';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { toast } from '../../../../components/Toast';
import {
  FINAL_DECISION_OPTIONS,
  finalDecisionLabel,
} from './final-decision-options';

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
  const { applyFinalDecision } = useInvestigation();
  const locked = isInvestigationLocked(row.status);
  const [pending, setPending] = useState<FinalDecision | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingOption = FINAL_DECISION_OPTIONS.find((o) => o.value === pending);

  async function confirmDecision() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await applyFinalDecision(row.id, pending);
      toast(`최종 판정을 적용했습니다 · ${finalDecisionLabel(pending)}`);
      setPending(null);
    } catch (e) {
      toast(formatApiError(e, '최종 판정 적용에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
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
                  disabled={locked || busy}
                  onClick={() => {
                    if (!locked) setPending(opt.value);
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

        {locked && !row.finalDecision ? (
          <p className="mt-3 text-xs text-ink-500">
            Completed / Archived 상태에서는 최종 판정을 적용할 수 없습니다.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={pending != null}
        title="최종 판정 확인"
        description={
          pendingOption
            ? `'${pendingOption.label}' — ${pendingOption.description} Case는 Completed로 변경됩니다.`
            : undefined
        }
        confirmLabel={busy ? '적용 중…' : '판정 확정'}
        cancelLabel="취소"
        tone={
          pending === 'resale_confirmed'
            ? 'danger'
            : pending === 'excluded'
              ? 'teal'
              : 'default'
        }
        onCancel={() => {
          if (!busy) setPending(null);
        }}
        onConfirm={() => {
          void confirmDecision();
        }}
      />
    </section>
  );
}
