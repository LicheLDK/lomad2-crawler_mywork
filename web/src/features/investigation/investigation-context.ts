import { createContext } from 'react';
import type {
  FinalDecision,
  InvestigationCase,
  InvestigationPriority,
  InvestigationStatus,
  ServerInvestigationDto,
} from './types';

export type InvestigationAssignmentPatch = {
  assignee?: string | null;
  priority?: InvestigationPriority;
  dueDate?: string | null;
};

export type InvestigationContextValue = {
  cases: InvestigationCase[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  selected: InvestigationCase | null;
  openCase: (caseOrId: InvestigationCase | string) => void;
  closeCase: () => void;
  reload: () => void;
  /** mutation 응답 DTO로 목록·선택 케이스 동기화 */
  applyServerCase: (dto: ServerInvestigationDto) => InvestigationCase;
  changeStatus: (
    id: string,
    status: InvestigationStatus,
  ) => Promise<InvestigationCase>;
  updateAssignment: (
    id: string,
    patch: InvestigationAssignmentPatch,
  ) => Promise<InvestigationCase>;
  addNote: (
    id: string,
    body: string,
    author?: string,
  ) => Promise<InvestigationCase>;
  updateNote: (
    id: string,
    noteId: string,
    body: string,
  ) => Promise<InvestigationCase>;
  deleteNote: (id: string, noteId: string) => Promise<InvestigationCase>;
  applyFinalDecision: (
    id: string,
    decision: FinalDecision,
    note?: string,
  ) => Promise<InvestigationCase>;
};

export const InvestigationContext =
  createContext<InvestigationContextValue | null>(null);
