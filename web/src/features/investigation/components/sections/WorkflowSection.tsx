import { Lock } from 'lucide-react';
import type { InvestigationCase, InvestigationStatus } from '../../types';
import { changeInvestigationStatus } from '../../lib/store';
import {
  isInvestigationLocked,
  isStatusChangeLocked,
  selectableWorkflowStatuses,
  WORKFLOW_STATUSES,
} from '../../lib/workflow';
import { toast } from '../../../../components/Toast';
import { Badge } from '../../../../components/ui/badge';

export function InvestigationWorkflowPanel({
  row,
}: {
  row: InvestigationCase;
}) {
  const locked = isInvestigationLocked(row.status);
  const statusLocked = isStatusChangeLocked(row.status);
  const options = selectableWorkflowStatuses(row.status);
  const step = WORKFLOW_STATUSES.indexOf(row.status) + 1;

  function onChange(next: InvestigationStatus) {
    if (next === row.status) return;
    const updated = changeInvestigationStatus(row.id, next);
    if (!updated) {
      toast('?? ??? ???? ????.');
      return;
    }
    toast(`??? ${next}(?)? ???????.`);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
          Workflow
        </h3>
        <Badge variant="secondary">
          {step}/{WORKFLOW_STATUSES.length}
        </Badge>
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-4">
        <p className="mb-3 text-[11px] leading-relaxed text-ink-400">
          Open ? Investigating ? Review ? Completed ? Archived
        </p>

        <label className="block text-xs text-ink-400" htmlFor={`wf-${row.id}`}>
          ??
        </label>
        <select
          id={`wf-${row.id}`}
          value={row.status}
          disabled={statusLocked}
          onChange={(e) => onChange(e.target.value as InvestigationStatus)}
          className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-sand-50 disabled:text-ink-500"
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
              {s === row.status ? ' (??)' : ''}
            </option>
          ))}
        </select>

        {locked ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-500">
            <Lock className="h-3.5 w-3.5" />
            Completed ???? ??? ? ????
            {row.status === 'Completed' && !statusLocked
              ? ' ? Archived?? ?? ??'
              : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}
