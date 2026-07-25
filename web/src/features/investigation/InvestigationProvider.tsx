import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { InvestigationCase } from './types';
import {
  INVESTIGATION_CHANGED,
  loadInvestigationCases,
} from './lib/store';
import { CaseDrawer } from './components/CaseDrawer';

type InvestigationContextValue = {
  cases: InvestigationCase[];
  selectedId: string | null;
  selected: InvestigationCase | null;
  openCase: (caseOrId: InvestigationCase | string) => void;
  closeCase: () => void;
  reload: () => void;
};

const InvestigationContext = createContext<InvestigationContextValue | null>(
  null,
);

/**
 * 전역 Case Management 컨텍스트
 * — 검색 페이지에서도 Drawer로 Case를 열어 흐름을 끊지 않음
 */
export function InvestigationProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<InvestigationCase[]>(() =>
    loadInvestigationCases(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setCases(loadInvestigationCases());
  }, []);

  useEffect(() => {
    window.addEventListener(INVESTIGATION_CHANGED, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(INVESTIGATION_CHANGED, reload);
      window.removeEventListener('storage', reload);
    };
  }, [reload]);

  const selected = useMemo(
    () => (selectedId ? cases.find((c) => c.id === selectedId) ?? null : null),
    [cases, selectedId],
  );

  const openCase = useCallback((caseOrId: InvestigationCase | string) => {
    const id = typeof caseOrId === 'string' ? caseOrId : caseOrId.id;
    setSelectedId(id);
  }, []);

  const closeCase = useCallback(() => {
    window.setTimeout(() => setSelectedId(null), 0);
  }, []);

  const value = useMemo(
    () => ({
      cases,
      selectedId,
      selected,
      openCase,
      closeCase,
      reload,
    }),
    [cases, selectedId, selected, openCase, closeCase, reload],
  );

  return (
    <InvestigationContext.Provider value={value}>
      {children}
      <CaseDrawer row={selected} onClose={closeCase} />
    </InvestigationContext.Provider>
  );
}

export function useInvestigation() {
  const ctx = useContext(InvestigationContext);
  if (!ctx) {
    throw new Error('useInvestigation must be used within InvestigationProvider');
  }
  return ctx;
}

/** Provider 밖(테스트 등)에서도 안전하게 */
export function useInvestigationOptional() {
  return useContext(InvestigationContext);
}
