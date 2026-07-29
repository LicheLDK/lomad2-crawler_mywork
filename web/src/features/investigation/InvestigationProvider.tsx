import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../../api';
import type {
  FinalDecision,
  InvestigationCase,
  InvestigationStatus,
  ServerInvestigationDto,
} from './types';
import { mapServerCase } from './lib/mapServerCase';
import { CaseDrawer } from './components/CaseDrawer';
import {
  InvestigationContext,
  type InvestigationAssignmentPatch,
  type InvestigationContextValue,
} from './investigation-context';

const LIST_LIMIT = 100;

/**
 * 전역 Case Management 컨텍스트
 * — 서버 GET으로 목록/상세를 읽고, Drawer mutation 은 D-4 API 로 저장
 */
export function InvestigationProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const applyServerCase = useCallback((dto: ServerInvestigationDto) => {
    const mapped = mapServerCase(dto);
    setCases((prev) => {
      const idx = prev.findIndex((c) => c.id === mapped.id);
      if (idx < 0) return [mapped, ...prev];
      const next = [...prev];
      next[idx] = mapped;
      return next;
    });
    return mapped;
  }, []);

  const fetchCases = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await api.listInvestigations(LIST_LIMIT);
      setCases(res.items.map(mapServerCase));
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Investigation 목록을 불러오지 못했습니다.',
      );
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    void fetchCases();
  }, [fetchCases]);

  // 서버 목록 동기화 (외부 시스템). focus/visibility에서도 silent 재조회.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount 시 서버 fetch
    void fetchCases();

    const onFocus = () => void fetchCases({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchCases({ silent: true });
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchCases]);

  const selected = useMemo(
    () => (selectedId ? cases.find((c) => c.id === selectedId) ?? null : null),
    [cases, selectedId],
  );

  const openCase = useCallback(
    (caseOrId: InvestigationCase | string) => {
      const id = typeof caseOrId === 'string' ? caseOrId : caseOrId.id;
      if (typeof caseOrId !== 'string') {
        setCases((prev) => {
          if (prev.some((c) => c.id === caseOrId.id)) return prev;
          return [caseOrId, ...prev];
        });
      }
      setSelectedId(id);

      void (async () => {
        try {
          const dto = await api.getInvestigation(id);
          applyServerCase(dto);
        } catch {
          /* 목록 항목으로 Drawer 유지 */
        }
      })();
    },
    [applyServerCase],
  );

  const closeCase = useCallback(() => {
    window.setTimeout(() => setSelectedId(null), 0);
  }, []);

  const changeStatus = useCallback(
    async (id: string, status: InvestigationStatus) => {
      const dto = await api.patchInvestigationStatus(id, { status });
      return applyServerCase(dto);
    },
    [applyServerCase],
  );

  const updateAssignment = useCallback(
    async (id: string, patch: InvestigationAssignmentPatch) => {
      const dto = await api.patchInvestigation(id, patch);
      return applyServerCase(dto);
    },
    [applyServerCase],
  );

  const addNote = useCallback(
    async (id: string, body: string, author?: string) => {
      const dto = await api.addInvestigationNote(id, { body, author });
      return applyServerCase(dto);
    },
    [applyServerCase],
  );

  const updateNote = useCallback(
    async (id: string, noteId: string, body: string) => {
      const dto = await api.updateInvestigationNote(id, noteId, { body });
      return applyServerCase(dto);
    },
    [applyServerCase],
  );

  const deleteNote = useCallback(
    async (id: string, noteId: string) => {
      const dto = await api.deleteInvestigationNote(id, noteId);
      return applyServerCase(dto);
    },
    [applyServerCase],
  );

  const applyFinalDecision = useCallback(
    async (id: string, decision: FinalDecision, note?: string) => {
      const dto = await api.applyInvestigationFinalDecision(id, {
        decision,
        note,
      });
      return applyServerCase(dto);
    },
    [applyServerCase],
  );

  const value = useMemo<InvestigationContextValue>(
    () => ({
      cases,
      loading,
      error,
      selectedId,
      selected,
      openCase,
      closeCase,
      reload,
      applyServerCase,
      changeStatus,
      updateAssignment,
      addNote,
      updateNote,
      deleteNote,
      applyFinalDecision,
    }),
    [
      cases,
      loading,
      error,
      selectedId,
      selected,
      openCase,
      closeCase,
      reload,
      applyServerCase,
      changeStatus,
      updateAssignment,
      addNote,
      updateNote,
      deleteNote,
      applyFinalDecision,
    ],
  );

  return (
    <InvestigationContext.Provider value={value}>
      {children}
      <CaseDrawer row={selected} onClose={closeCase} />
    </InvestigationContext.Provider>
  );
}
