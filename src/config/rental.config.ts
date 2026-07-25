import { registerAs } from '@nestjs/config';

/**
 * Laravel 쇼핑몰(렌탈) 외부 API 설정.
 * Search Server는 주문/상품 DB에 직접 접근하지 않고 이 Client로만 조회한다.
 */
export default registerAs('rental', () => ({
  baseUrl: (process.env.RENTAL_API_BASE_URL || '').replace(/\/$/, ''),
  apiKey: process.env.RENTAL_API_KEY || '',
  timeoutMs: parseInt(process.env.RENTAL_API_TIMEOUT_MS || '10000', 10),
  /** 주문 상세 — `:orderId` 치환 */
  orderPath:
    process.env.RENTAL_ORDER_PATH || '/api/internal/orders/:orderId',
  /** 상품 상세 — `:productId` 치환 */
  productPath:
    process.env.RENTAL_PRODUCT_PATH || '/api/internal/products/:productId',
  /**
   * 검색 완료 Callback — BackOffice POST path
   * 예: /api/internal/search-jobs/callback
   */
  callbackPath:
    process.env.RENTAL_SEARCH_CALLBACK_PATH ||
    '/api/internal/search-jobs/callback',
  callbackEnabled:
    (process.env.RENTAL_SEARCH_CALLBACK_ENABLED || 'true').toLowerCase() !==
    'false',
}));
