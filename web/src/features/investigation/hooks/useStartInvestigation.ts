import type { SearchResult } from '../../../types';
import { createInvestigationFromResult } from '../lib/store';
import { useInvestigationOptional } from '../InvestigationProvider';
import { toast } from '../../../components/Toast';

/**
 * 검색 결과에서 Investigation Case 생성
 * — 페이지 이동 없음. 선택 시 Drawer로 즉시 열기 가능.
 */
export function useStartInvestigation() {
  const inv = useInvestigationOptional();

  return function startInvestigation(
    row: SearchResult,
    options?: { openDrawer?: boolean },
  ) {
    const created = createInvestigationFromResult(row);
    toast('Investigation이 생성되었습니다.');
    if (options?.openDrawer !== false && inv) {
      inv.openCase(created);
    }
    return created;
  };
}
