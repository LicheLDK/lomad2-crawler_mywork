import { registerAs } from '@nestjs/config';

/**
 * Investigation 자동 생성 설정.
 * AI Score 임계값은 AI Rule Engine(create_investigation)이 우선.
 * INVESTIGATION_AI_SCORE_THRESHOLD 는 Rule seed 기본값으로 사용.
 */
export default registerAs('investigation', () => ({
  aiScoreThreshold: parseInt(
    process.env.INVESTIGATION_AI_SCORE_THRESHOLD || '90',
    10,
  ),
  /**
   * 자동 생성 임계 미만이지만 관찰할 하한 (기본 70).
   * watchlistMin ≤ score < createThreshold → Investigation 생성 + watchlisted=true
   * 0 이하면 워치리스트 비활성.
   */
  watchlistMinScore: parseInt(
    process.env.INVESTIGATION_WATCHLIST_MIN_SCORE || '70',
    10,
  ),
  autoCreateEnabled:
    (process.env.INVESTIGATION_AUTO_CREATE || 'true').toLowerCase() !==
    'false',
  /**
   * BackOffice 주문 상세 URL 템플릿.
   * {orderNo} 자리를 주문번호로 치환.
   * 예: https://admin.example.com/getOrderInfo?order_id={orderNo}
   */
  orderUrlTemplate: (
    process.env.BACKOFFICE_ORDER_URL_TEMPLATE ||
    '/getOrderInfo?order_id={orderNo}'
  ).trim(),
}));
