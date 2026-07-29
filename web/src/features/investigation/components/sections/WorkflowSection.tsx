import { useState } from 'react';
import type { InvestigationCase, InvestigationStatus } from '../../types';
import {
  isStatusChangeLocked,
  selectableWorkflowStatuses,
  WORKFLOW_STATUSES,
} from '../../lib/workflow';
import { useInvestigation } from '../../useInvestigation';
import { formatApiError } from '../../../../api';
import { Badge } from '../../../../components/ui/badge';
import { toast } from '../../../../components/Toast';

export function InvestigationWorkflowPanel({
  row,
}: {
  row: InvestigationCase;
}) {
  const { changeStatus } = useInvestigation();
  const [busy, setBusy] = useState(false);
  const options = selectableWorkflowStatuses(row.status);
  const step = WORKFLOW_STATUSES.indexOf(row.status) + 1;
  const locked = isStatusChangeLocked(row.status);

  async function onChange(next: InvestigationStatus) {
    if (next === row.status || locked || busy) return;
    setBusy(true);
    try {
      await changeStatus(row.id, next);
      toast(`상태를 ${next}(으)로 변경했습니다.`);
    } catch (e) {
      toast(formatApiError(e, '상태 변경에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
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
          Open → Investigating → Review → Completed → Archived
        </p>

        <label className="block text-xs text-ink-400" htmlFor={`wf-${row.id}`}>
          현재
        </label>
        <select
          id={`wf-${row.id}`}
          value={row.status}
          disabled={locked || busy}
          onChange={(e) => {
            void onChange(e.target.value as InvestigationStatus);
          }}
          className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-sand-50 disabled:text-ink-500"
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
              {s === row.status ? ' (현재)' : ''}
            </option>
          ))}
        </select>

        {locked ? (
          <p className="mt-3 text-xs text-ink-500">
            Archived 케이스는 상태를 변경할 수 없습니다.
          </p>
        ) : busy ? (
          <p className="mt-3 text-xs text-ink-400">저장 중…</p>
        ) : null}
      </div>
    </section>
  );
}
