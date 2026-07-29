/**
 * Investigation Case Management Module
 * Jira / Linear / GitHub Issues / GSC 스타일 — Drawer 중심, 검색 흐름 유지
 */

export type * from './types';
export {
  INVESTIGATION_STATUSES,
  INVESTIGATION_PRIORITIES,
  INVESTIGATION_ASSIGNEES,
} from './types';

export { InvestigationProvider } from './InvestigationProvider';
export {
  useInvestigation,
  useInvestigationOptional,
} from './useInvestigation';

export { CaseListPage, InvestigationPage } from './components/CaseListPage';
export { CaseDrawer, InvestigationDrawer } from './components/CaseDrawer';
export { CaseSummaryCard } from './components/CaseSummaryCard';
export {
  StatusBadge,
  InvestigationStatusBadge,
} from './components/StatusBadge';

export { useStartInvestigation } from './hooks/useStartInvestigation';

export { mapServerCase } from './lib/mapServerCase';
export type { InvestigationStatsResponse } from './types';

export {
  isInvestigationLocked,
  WORKFLOW_STATUSES,
} from './lib/workflow';
