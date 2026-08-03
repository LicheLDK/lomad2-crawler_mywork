import { useState } from 'react';
import type { InvestigationCase, InvestigationStatus } from '../../types';
import {
  canTransitionStatus,
  isStatusChangeLocked,
  selectableWorkflowStatuses,
  WORKFLOW_STATUSES,
} from '../../lib/workflow';
import { useInvestigation } from '../../useInvestigation';
import { formatApiError } from '../../../../api';
import { Badge } from '../../../../components/ui/badge';
import { toast } from '../../../../components/Toast';
import { InvestigationDeleteDialog } from '../InvestigationDeleteDialog';

export function InvestigationWorkflowPanel({
  row,
}: {
  row: InvestigationCase;
}) {
  const { changeStatus, closeCase } = useInvestigation();
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const options = selectableWorkflowStatuses(row.status);
  const step = WORKFLOW_STATUSES.indexOf(row.status) + 1;
  const locked = isStatusChangeLocked(row.status);

  async function applyStatus(next: InvestigationStatus, asDelete = false) {
    if (next === row.status || locked || busy) return;
    setBusy(true);
    try {
      await changeStatus(row.id, next);
      if (asDelete) {
        setPendingDelete(false);
        toast('조사를 삭제했습니다.');
        closeCase();
      } else {
        toast(`상태를 ${next}(으)로 변경했습니다.`);
      }
    } catch (e) {
      toast(
        formatApiError(
          e,
          asDelete ? '삭제에 실패했습니다.' : '상태 변경에 실패했습니다.',
        ),
        { tone: 'error' },
      );
    } finally {
      setBusy(false);
    }
  }

  function onChange(next: InvestigationStatus) {
    if (next === row.status || locked || busy) return;
    if (next === 'Archived') {
      setPendingDelete(true);
      return;
    }
    void applyStatus(next);
  }

  const canDelete = canTransitionStatus(row.status, 'Archived');

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
            onChange(e.target.value as InvestigationStatus);
          }}
          className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-sand-50 disabled:text-ink-500"
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {s === 'Archived' ? 'Archived (삭제)' : s}
              {s === row.status ? ' (현재)' : ''}
            </option>
          ))}
        </select>

        {canDelete && !locked ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingDelete(true)}
            className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
          >
            조사 삭제
          </button>
        ) : null}

        {locked ? (
          <p className="mt-3 text-xs text-ink-500">
            Archived 케이스는 상태를 변경할 수 없습니다.
          </p>
        ) : busy ? (
          <p className="mt-3 text-xs text-ink-400">저장 중…</p>
        ) : null}
      </div>

      <InvestigationDeleteDialog
        open={pendingDelete}
        loading={busy}
        onCancel={() => {
          if (!busy) setPendingDelete(false);
        }}
        onConfirm={() => {
          void applyStatus('Archived', true);
        }}
      />
    </section>
  );
}
