import type { SearchResult } from '../../../types';
import { WRITE_API_PENDING_HINT } from '../types';
import { toast } from '../../../components/Toast';

/**
 * 검색 결과에서 Investigation Case 생성
 * — D-1: 쓰기 API 연결 전. localStorage에 쓰지 않음. D-6에서 POST 연결.
 */
export function useStartInvestigation() {
  return function startInvestigation(
    _row: SearchResult,
    _options?: { openDrawer?: boolean },
  ): null {
    toast(`${WRITE_API_PENDING_HINT} — 수동 조사 시작은 곧 연결됩니다.`);
    return null;
  };
}
