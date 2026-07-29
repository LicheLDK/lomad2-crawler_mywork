import { useContext } from 'react';
import { InvestigationContext } from './investigation-context';

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
