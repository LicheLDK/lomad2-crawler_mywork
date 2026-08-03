import { Badge } from '../../../components/ui/badge';
import { cn } from '../../../lib/utils';
import type { InvestigationStatus } from '../types';

const TONE: Record<InvestigationStatus, string> = {
  Open: 'bg-sky-50 text-sky-800 ring-sky-200/80',
  Investigating: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  Review: 'bg-violet-50 text-violet-800 ring-violet-200/80',
  Completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  Archived: 'bg-ink-100 text-ink-600 ring-ink-200/80',
};

export function InvestigationStatusBadge({
  status,
}: {
  status: InvestigationStatus;
}) {
  return (
    <Badge
      dot
      variant="outline"
      className={cn(
        'rounded-md border-transparent px-2 py-0.5 text-xs font-medium ring-1 hover:bg-transparent',
        TONE[status] ?? TONE.Open,
      )}
    >
      {status}
    </Badge>
  );
}

export const StatusBadge = InvestigationStatusBadge;
