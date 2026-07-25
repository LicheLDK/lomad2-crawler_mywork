/**
 * BackOffice 주문 상세 URL.
 * VITE_BACKOFFICE_ORDER_URL_TEMPLATE 예:
 * http://127.0.0.1/getOrderInfo?order_id={orderNo}
 */
export function buildOrderUrl(orderNo?: string | null): string | null {
  if (!orderNo?.trim()) return null;
  const template =
    import.meta.env.VITE_BACKOFFICE_ORDER_URL_TEMPLATE?.trim() ||
    '/getOrderInfo?order_id={orderNo}';
  return template.replace(
    /\{orderNo\}/g,
    encodeURIComponent(orderNo.trim()),
  );
}
