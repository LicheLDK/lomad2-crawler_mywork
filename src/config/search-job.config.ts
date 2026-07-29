import { registerAs } from '@nestjs/config';

/**
 * Search Job 타임아웃 (A3 이중 상한).
 * - keyword: 키워드별 개별 상한 (기본 3분 = 2초 × 90회)
 * - total: Job 전체 상한 (기본 10분)
 */
export default registerAs('searchJob', () => ({
  keywordTimeoutMs: parseInt(
    process.env.SEARCH_JOB_KEYWORD_TIMEOUT_MS || '180000',
    10,
  ),
  totalTimeoutMs: parseInt(
    process.env.SEARCH_JOB_TOTAL_TIMEOUT_MS || '600000',
    10,
  ),
}));
