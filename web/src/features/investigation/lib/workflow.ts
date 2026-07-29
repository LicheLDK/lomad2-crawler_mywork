import type { InvestigationStatus } from '../types';

/** Open → Investigating → Review → Completed → Archived */
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

/** Completed / Archived 에서는 콘텐츠 수정 불가 */
export function isInvestigationLocked(status: InvestigationStatus): boolean {
  return status === 'Completed' || status === 'Archived';
}

/** Archived 에서는 상태 변경도 불가 */
export function isStatusChangeLocked(status: InvestigationStatus): boolean {
  return status === 'Archived';
}

/**
 * Dropdown에 노출할 선택지:
 * - 현재 상태
 * - 다음 단계(1단계 전진)
 * - Completed 에서는 Archived만 추가 가능
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
