import type { InvestigationStatus } from '../types';

/** Open ??Investigating ??Review ??Completed ??Archived */
export const WORKFLOW_STATUSES: InvestigationStatus[] = [
  'Open',
  'Investigating',
  'Review',
  'Completed',
  'Archived',
];

export function workflowIndex(status: InvestigationStatus): number {
  const i = WORKFLOW_STATUSES.indexOf(status);
  return i >= 0 ? i : 0;
}

/** Completed / Archived ??ì½˜í…ì¸??˜ì • ë¶ˆê? */
export function isInvestigationLocked(status: InvestigationStatus): boolean {
  return status === 'Completed' || status === 'Archived';
}

/** Archived ???íƒœ ë³€ê²½ë„ ë¶ˆê? */
export function isStatusChangeLocked(status: InvestigationStatus): boolean {
  return status === 'Archived';
}

/**
 * Dropdown???¸ì¶œ??? íƒì§€:
 * - ?„ì¬ ?íƒœ
 * - ?¤ìŒ ?¨ê³„(1?¨ê³„ ?„ì§„)
 * - Completed ?ì„œ??Archivedë§?ì¶”ê? ê°€??
 */
export function selectableWorkflowStatuses(
  current: InvestigationStatus,
): InvestigationStatus[] {
  if (isStatusChangeLocked(current)) return [current];

  const idx = workflowIndex(current);
  const next = WORKFLOW_STATUSES[idx + 1];
  const options: InvestigationStatus[] = [current];
  if (next) options.push(next);
  return options;
}

export function canTransitionStatus(
  from: InvestigationStatus,
  to: InvestigationStatus,
): boolean {
  if (from === to) return true;
  if (isStatusChangeLocked(from)) return false;
  return selectableWorkflowStatuses(from).includes(to);
}
