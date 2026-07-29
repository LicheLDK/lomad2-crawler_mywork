import { Lock } from 'lucide-react';
import type {
  InvestigationCase,
  InvestigationPriority,
} from '../../types';
import {
  INVESTIGATION_ASSIGNEES,
  INVESTIGATION_PRIORITIES,
} from '../../types';
import { updateInvestigationAssignment } from '../../lib/store';
import { isInvestigationLocked } from '../../lib/workflow';
import { formatDateShort } from '../../../../lib/format';
import { toast } from '../../../../components/Toast';
import { Badge } from '../../../../components/ui/badge';
import { cn } from '../../../../lib/utils';

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

export function InvestigationAssignmentPanel({
  row,
}: {
  row: InvestigationCase;
}) {
  const locked = isInvestigationLocked(row.status);
  const priority = ((row.priority as string) === 'Critical'
    ? 'High'
    : (row.priority ?? 'Medium')) as InvestigationPriority;

  const assigneeOptions = Array.from(
    new Set([
      ...INVESTIGATION_ASSIGNEES,
      ...(row.assignee ? [row.assignee] : []),
    ]),
  );

  function apply(patch: {
    assignee?: string | null;
    priority?: InvestigationPriority;
    dueDate?: string | null;
  }) {
    if (locked) return;
    const updated = updateInvestigationAssignment(row.id, patch);
    if (!updated) {
      toast('담당을 변경할 수 없습니다.');
      return;
    }
    if (patch.assignee !== undefined && patch.assignee !== row.assignee) {
      toast(
        patch.assignee
          ? `담당자를 ${patch.assignee}(으)로 지정했습니다.`
          : '담당자를 해제했습니다.',
      );
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
            disabled={locked}
            onChange={(e) =>
              apply({ assignee: e.target.value ? e.target.value : null })
            }
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
                  disabled={locked}
                  onClick={() => apply({ priority: p })}
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
            disabled={locked}
            onChange={(e) =>
              apply({ dueDate: e.target.value ? e.target.value : null })
            }
            className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-sand-50"
          />
          {row.dueDate ? (
            <p className="mt-1.5 text-[11px] text-ink-400">
              마감 · {formatDateShort(row.dueDate)}
            </p>
          ) : null}
        </div>

        {locked ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-500">
            <Lock className="h-3.5 w-3.5" />
            Completed 이후에는 담당을 수정할 수 없습니다
          </p>
        ) : null}
      </div>
    </section>
  );
}
