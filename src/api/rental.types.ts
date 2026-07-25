/**
 * Laravel 쇼핑몰 BackOffice 주문/상품 조회용 타입.
 * Search Server 는 주문 DB 에 접근하지 않고 이 타입으로만 외부 API 응답을 다룬다.
 */

/** 외부 API 원시 응답 (snake / camel 혼용 허용) */
export interface RentalOrderRaw {
  order_id?: string | number;
  orderId?: string | number;
  contract_no?: string | null;
  contractNo?: string | null;
  easyrental_contract_num?: string | null;
  product_code?: string | number;
  productCode?: string | number;
  product_detail_code?: string | number;
  productDetailCode?: string | number;
  product_name?: string;
  productName?: string;
  brand_name?: string;
  brandName?: string;
  model_name?: string | null;
  modelName?: string | null;
  option?: string | null;
  option_name?: string | null;
  optionName?: string | null;
  color?: string | null;
  color_name?: string | null;
  colorName?: string | null;
  category_name?: string;
  categoryName?: string;
  sourcing_name?: string;
  sourcingName?: string;
  thumbnail_img_url?: string | null;
  thumbnailImgUrl?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  reference_image_url?: string | null;
  referenceImageUrl?: string | null;
  username?: string | null;
  customer_name?: string | null;
  customerName?: string | null;
  count?: number | null;
}

export interface RentalProductRaw {
  id?: string | number;
  product_id?: string | number;
  productId?: string | number;
  product_code?: string | number;
  productCode?: string | number;
  product_name?: string;
  productName?: string;
  brand_name?: string;
  brandName?: string;
  thumbnail_img_url?: string | null;
  thumbnailImgUrl?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
}

/**
 * 정규화된 주문 컨텍스트 (Search Server 내부 · 비영속).
 * DB 의 주문 마스터가 아니라 API 조회 결과다.
 */
export interface RentalOrder {
  orderId: string;
  contractNo: string | null;
  customerName: string | null;
  productId: string;
  productDetailCode: string | null;
  productName: string;
  brandName: string | null;
  modelName: string | null;
  option: string | null;
  color: string | null;
  categoryName: string | null;
  sourcingName: string | null;
  imageUrl: string | null;
  username: string | null;
  count: number | null;
}

/** 정규화된 상품 컨텍스트 */
export interface RentalProduct {
  productId: string;
  productCode: string | null;
  productName: string;
  brandName: string | null;
  imageUrl: string | null;
}

/**
 * Search Job 실행용으로 API 주문에서 뽑은 입력.
 * (키워드 생성 · 유사도 이미지)
 */
export interface RentalSearchInput {
  orderId: string;
  keyword: string;
  externalProductId: string;
  referenceImageUrl?: string;
  brand?: string | null;
  modelName?: string | null;
  option?: string | null;
  color?: string | null;
  productName: string;
  contractNo?: string | null;
  customerName?: string | null;
}

/** 검색 완료 시 BackOffice Callback 페이로드 */
export interface SearchCompletedCallbackPayload {
  jobId: string;
  investigationCount: number;
  completedAt: string;
  orderNo?: string | null;
  status?: 'completed';
}

export class RentalApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly path?: string,
  ) {
    super(message);
    this.name = 'RentalApiError';
  }
}
