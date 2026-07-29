import { useCallback, useRef } from 'react';
import { api, formatApiError } from '../../../api';
import type { SearchResult } from '../../../types';
import { toast } from '../../../components/Toast';
import { useInvestigation } from '../useInvestigation';
import type { InvestigationCase } from '../types';

export type StartInvestigationOptions = {
  /** 기본 true — CaseDrawer 오픈 */
  openDrawer?: boolean;
  searchHistoryId?: string;
  searchJobId?: string;
  orderNo?: string;
};

/**
 * 검색 결과에서 Investigation Case 수동 생성
 * — POST /api/investigations (resultId 중복 시 기존 케이스 반환)
 */
export function useStartInvestigation() {
  const { openCase, applyServerCase } = useInvestigation();
  const inflight = useRef<Set<string>>(new Set());

  return useCallback(
    async function startInvestigation(
      row: SearchResult,
      options?: StartInvestigationOptions,
    ): Promise<InvestigationCase | null> {
      if (inflight.current.has(row.id)) return null;
      inflight.current.add(row.id);
      try {
        const dto = await api.createInvestigation({
          resultId: row.id,
          searchHistoryId: options?.searchHistoryId ?? row.searchHistoryId,
          searchJobId: options?.searchJobId,
          orderNo: options?.orderNo,
        });
        const mapped = applyServerCase(dto);
        if (options?.openDrawer !== false) {
          openCase(mapped);
        }
        toast(`조사 케이스 ${mapped.caseNo}을(를) 열었습니다.`);
        return mapped;
      } catch (e) {
        toast(formatApiError(e, '조사 시작에 실패했습니다.'));
        return null;
      } finally {
        inflight.current.delete(row.id);
      }
    },
    [applyServerCase, openCase],
  );
}
