import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RentalClient } from './rental.client';
import {
  RentalApiError,
  type RentalOrder,
  type RentalOrderRaw,
  type RentalProduct,
  type RentalProductRaw,
  type RentalSearchInput,
  type SearchCompletedCallbackPayload,
} from './rental.types';

/**
 * Rental Domain Service — 유일한 주문정보 진입점.
 * Controller / Job / UI 는 이 Service(+ Client) 로만 주문을 조회한다.
 * Search Server DB 에 주문 마스터를 두지 않는다.
 */
@Injectable()
export class RentalService {
  private readonly logger = new Logger(RentalService.name);

  constructor(
    private readonly client: RentalClient,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  isCallbackEnabled(): boolean {
    return (
      this.config.get<boolean>('rental.callbackEnabled') !== false &&
      this.client.isConfigured()
    );
  }

  /**
   * 검색 완료 → BackOffice Callback
   * (Job ID · Investigation Count · Completed At)
   */
  async notifySearchCompleted(
    payload: SearchCompletedCallbackPayload,
  ): Promise<boolean> {
    if (!this.isCallbackEnabled()) {
      this.logger.debug(
        `Skip search callback (disabled or RENTAL_API_BASE_URL empty) jobId=${payload.jobId}`,
      );
      return false;
    }

    await this.client.postSearchCompletedCallback({
      jobId: payload.jobId,
      investigationCount: payload.investigationCount,
      completedAt: payload.completedAt,
      orderNo: payload.orderNo ?? null,
      status: payload.status ?? 'completed',
    });

    this.logger.log(
      `BackOffice callback sent jobId=${payload.jobId} investigations=${payload.investigationCount}`,
    );
    return true;
  }

  /** 주문 ID → 정규화 주문 정보 (외부 API only) */
  async getOrder(orderId: string): Promise<RentalOrder> {
    if (!this.client.isConfigured()) {
      throw new RentalApiError(
        'RENTAL_API_BASE_URL 이 설정되지 않았습니다. BackOffice API 없이 주문정보를 조회할 수 없습니다.',
        503,
      );
    }
    const raw = await this.client.getOrder(orderId);
    const order = this.normalizeOrder(raw, orderId);
    this.logger.debug(
      `Rental order loaded orderId=${order.orderId} product=${order.productName}`,
    );
    return order;
  }

  /** 상품 ID → 정규화 상품 정보 */
  async getProduct(productId: string): Promise<RentalProduct> {
    if (!this.client.isConfigured()) {
      throw new RentalApiError(
        'RENTAL_API_BASE_URL 이 설정되지 않았습니다.',
        503,
      );
    }
    const raw = await this.client.getProduct(productId);
    return this.normalizeProduct(raw, productId);
  }

  /**
   * 주문번호 → Search Job 실행 입력 (키워드·이미지).
   * BackOffice 「중고 검색」→ Search Server 진입 시 사용.
   */
  async resolveSearchInput(orderId: string): Promise<RentalSearchInput> {
    const order = await this.getOrder(orderId);
    if (!order.productName?.trim()) {
      throw new RentalApiError(
        `주문 ${orderId} 에 상품명이 없습니다.`,
        422,
      );
    }

    return {
      orderId: order.orderId,
      keyword: order.productName.trim(),
      externalProductId: order.productId || order.orderId,
      referenceImageUrl: order.imageUrl ?? undefined,
      brand: order.brandName,
      modelName: order.modelName,
      option: order.option,
      color: order.color,
      productName: order.productName.trim(),
      contractNo: order.contractNo,
      customerName: order.customerName,
    };
  }

  /** UI / API 응답용 주문 컨텍스트 (비영속) */
  toPublicOrder(order: RentalOrder) {
    return {
      orderNo: order.orderId,
      contractNo: order.contractNo,
      customerName: order.customerName,
      productNo: order.productId,
      productName: order.productName,
      brand: order.brandName,
      modelName: order.modelName,
      option: order.option,
      color: order.color,
      imageUrl: order.imageUrl,
    };
  }

  normalizeOrder(raw: RentalOrderRaw, fallbackOrderId?: string): RentalOrder {
    const orderId = String(
      raw.order_id ?? raw.orderId ?? fallbackOrderId ?? '',
    );
    const productId = String(
      raw.product_code ??
        raw.productCode ??
        raw.product_detail_code ??
        raw.productDetailCode ??
        '',
    );
    const productName = String(
      raw.product_name ?? raw.productName ?? '',
    ).trim();
    const imageUrl =
      pickUrl(
        raw.reference_image_url,
        raw.referenceImageUrl,
        raw.thumbnail_img_url,
        raw.thumbnailImgUrl,
        raw.image_url,
        raw.imageUrl,
      ) ?? null;

    return {
      orderId,
      contractNo: toNullableString(
        raw.contract_no ??
          raw.contractNo ??
          raw.easyrental_contract_num,
      ),
      customerName: toNullableString(
        raw.customer_name ?? raw.customerName ?? raw.username,
      ),
      productId: productId || orderId,
      productDetailCode: toNullableString(
        raw.product_detail_code ?? raw.productDetailCode,
      ),
      productName,
      brandName: toNullableString(raw.brand_name ?? raw.brandName),
      modelName: toNullableString(raw.model_name ?? raw.modelName),
      option: toNullableString(
        raw.option ?? raw.option_name ?? raw.optionName,
      ),
      color: toNullableString(
        raw.color ?? raw.color_name ?? raw.colorName,
      ),
      categoryName: toNullableString(raw.category_name ?? raw.categoryName),
      sourcingName: toNullableString(raw.sourcing_name ?? raw.sourcingName),
      imageUrl,
      username: toNullableString(raw.username),
      count:
        typeof raw.count === 'number' && Number.isFinite(raw.count)
          ? raw.count
          : null,
    };
  }

  normalizeProduct(
    raw: RentalProductRaw,
    fallbackProductId?: string,
  ): RentalProduct {
    const productId = String(
      raw.product_id ??
        raw.productId ??
        raw.id ??
        raw.product_code ??
        raw.productCode ??
        fallbackProductId ??
        '',
    );
    return {
      productId,
      productCode: toNullableString(raw.product_code ?? raw.productCode),
      productName: String(raw.product_name ?? raw.productName ?? '').trim(),
      brandName: toNullableString(raw.brand_name ?? raw.brandName),
      imageUrl:
        pickUrl(
          raw.thumbnail_img_url,
          raw.thumbnailImgUrl,
          raw.image_url,
          raw.imageUrl,
        ) ?? null,
    };
  }
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function pickUrl(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c.trim())) {
      return c.trim();
    }
  }
  return undefined;
}
