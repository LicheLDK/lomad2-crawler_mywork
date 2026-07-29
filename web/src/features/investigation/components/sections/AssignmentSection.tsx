import { useState } from 'react';
import type {
  InvestigationCase,
  InvestigationPriority,
} from '../../types';
import {
  INVESTIGATION_ASSIGNEES,
  INVESTIGATION_PRIORITIES,
} from '../../types';
import { useInvestigation } from '../../useInvestigation';
import { formatApiError } from '../../../../api';
import { formatDateShort } from '../../../../lib/format';
import { Badge } from '../../../../components/ui/badge';
import { cn } from '../../../../lib/utils';
import { toast } from '../../../../components/Toast';

function priorityVariant(
  p: InvestigationPriority,
): 'destructive' | 'default' | 'secondary' | 'outline' | 'teal' {
  if (p === 'High') return 'destructive';
  if (p === 'Medium') return 'default';
  return 'secondary';
}

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) {
    return value.slice(0, 10);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateInputToIso(value: string): string {
  return `${value}T00:00:00.000Z`;
}

export function InvestigationAssignmentPanel({
  row,
}: {
  row: InvestigationCase;
}) {
  const { updateAssignment } = useInvestigation();
  const [busy, setBusy] = useState(false);
  const priority = ((row.priority as string) === 'Critical'
    ? 'High'
    : (row.priority ?? 'Medium')) as InvestigationPriority;

  const assigneeOptions = Array.from(
    new Set([
      ...INVESTIGATION_ASSIGNEES,
      ...(row.assignee ? [row.assignee] : []),
    ]),
  );

  async function save(
    patch: {
      assignee?: string | null;
      priority?: InvestigationPriority;
      dueDate?: string | null;
    },
    okMessage: string,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await updateAssignment(row.id, patch);
      toast(okMessage);
    } catch (e) {
      toast(formatApiError(e, '담당 정보 저장에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
          Assignment
        </h3>
        <Badge variant={priorityVariant(priority ?? 'Medium')}>
          {priority ?? 'Medium'}
        </Badge>
      </div>

      <div className="space-y-4 rounded-xl border border-ink-100 bg-white p-4">
        <div>
          <label
            className="block text-xs text-ink-400"
            htmlFor={`assignee-${row.id}`}
          >
            담당자
          </label>
          <select
            id={`assignee-${row.id}`}
            value={row.assignee ?? ''}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value.trim() || null;
              if (next === (row.assignee ?? null)) return;
              void save({ assignee: next }, '담당자를 저장했습니다.');
            }}
            className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-sand-50"
          >
            <option value="">미지정</option>
            {assigneeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs text-ink-400">우선순위</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INVESTIGATION_PRIORITIES.map((p) => {
              const active = (priority ?? 'Medium') === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={busy || active}
                  onClick={() => {
                    void save({ priority: p }, `우선순위를 ${p}(으)로 저장했습니다.`);
                  }}
                  className={cn(
                    'rounded-full transition disabled:cursor-not-allowed disabled:opacity-60',
                    active ? 'ring-2 ring-teal-600/40 ring-offset-1' : '',
                  )}
                >
                  <Badge
                    variant={active ? priorityVariant(p) : 'outline'}
                    className="cursor-pointer px-2.5 py-1 text-[11px]"
                  >
                    {p}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            className="block text-xs text-ink-400"
            htmlFor={`due-${row.id}`}
          >
            마감일
          </label>
          <input
            id={`due-${row.id}`}
            type="date"
            value={toDateInputValue(row.dueDate)}
            disabled={busy}
            onChange={(e) => {
              const raw = e.target.value;
              const next = raw ? dateInputToIso(raw) : null;
              const prev = toDateInputValue(row.dueDate);
              if (raw === prev) return;
              void save(
                { dueDate: next },
                next ? '마감일을 저장했습니다.' : '마감일을 해제했습니다.',
              );
            }}
            className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-sand-50"
          />
          {row.dueDate ? (
            <p className="mt-1.5 text-[11px] text-ink-400">
              마감 · {formatDateShort(row.dueDate)}
            </p>
          ) : null}
        </div>

        {busy ? (
          <p className="text-xs text-ink-400">저장 중…</p>
        ) : null}
      </div>
    </section>
  );
}
