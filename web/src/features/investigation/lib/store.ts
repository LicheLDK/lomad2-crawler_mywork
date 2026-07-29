import type {
  InvestigationCase,
  InvestigationNote,
  InvestigationPriority,
  InvestigationStatus,
  FinalDecision,
} from '../types';
import { WRITE_API_PENDING_HINT } from '../types';

/**
 * ??? localStorage ? (D-7?? ??).
 * D-5/D-6: ???·??·?? ??? ?? API? ??.
 */
export const INVESTIGATION_STORAGE_KEYS = {
  cases: 'crawler.dashboard.investigation.cases',
  seq: 'crawler.dashboard.investigation.seq',
  seeded: 'crawler.dashboard.investigation.seeded.v6',
} as const;

/** @deprecated D-5 ?? ??? ?? ?? */
export const INVESTIGATION_CHANGED = 'investigation:changed';

/** D-5: localStorage ??? ?? ?? ??? */
export const LOCAL_WRITES_DISABLED = true;

/**
 * D-1~: mock ??·localStorage ?? ??.
 * ??? InvestigationProvider ?? GET? ??.
 */
export function loadInvestigationCases(): InvestigationCase[] {
  return [];
}

function rejectWrite(): null {
  return null;
}

/** @deprecated D-5: Provider mutation / API ??. localStorage ?? ?? */
export function updateInvestigationCase(
  _id: string,
  _patch: Partial<InvestigationCase>,
): InvestigationCase | null {
  return rejectWrite();
}

/** @deprecated D-5: useInvestigation().changeStatus */
export function changeInvestigationStatus(
  _caseId: string,
  _nextStatus: InvestigationStatus,
): InvestigationCase | null {
  return rejectWrite();
}

/** @deprecated D-5: useInvestigation().applyFinalDecision */
export function applyFinalDecision(
  _caseId: string,
  _decision: FinalDecision,
): InvestigationCase | null {
  return rejectWrite();
}

/** @deprecated D-5: useInvestigation().updateAssignment */
export function updateInvestigationAssignment(
  _caseId: string,
  _patch: {
    assignee?: string | null;
    priority?: InvestigationPriority;
    dueDate?: string | null;
  },
): InvestigationCase | null {
  return rejectWrite();
}

/** Evidence CRUD? D3?? ?? ? */
export function deleteInvestigationEvidence(
  _caseId: string,
  _evidenceId: string,
): InvestigationCase | null {
  return rejectWrite();
}

/** @deprecated D-5: useInvestigation().addNote */
export function addInvestigationNote(
  _caseId: string,
  _body: string,
  _author: string,
): InvestigationCase | null {
  return rejectWrite();
}

/** @deprecated D-5: useInvestigation().updateNote */
export function updateInvestigationNote(
  _caseId: string,
  _noteId: string,
  _body: string,
): InvestigationCase | null {
  return rejectWrite();
}

/** @deprecated D-5: useInvestigation().deleteNote */
export function deleteInvestigationNote(
  _caseId: string,
  _noteId: string,
): InvestigationCase | null {
  return rejectWrite();
}

/** @deprecated D-6 ?? ?? ? D-7?? ?? ?? */
export function writePendingMessage(): string {
  return WRITE_API_PENDING_HINT;
}

export function nextCaseNumber(): string {
  return `CASE-PENDING-${Date.now()}`;
}

export type { InvestigationNote };
