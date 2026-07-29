import { createContext } from 'react';
import type { InvestigationCase } from './types';

export type InvestigationContextValue = {
  cases: InvestigationCase[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  selected: InvestigationCase | null;
  openCase: (caseOrId: InvestigationCase | string) => void;
  closeCase: () => void;
  reload: () => void;
};

export const InvestigationContext =
  createContext<InvestigationContextValue | null>(null);
