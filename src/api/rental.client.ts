import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RentalApiError,
  type RentalOrderRaw,
  type RentalProductRaw,
} from './rental.types';

/**
 * Laravel 쇼핑몰 외부 API HTTP Client.
 * 모든 아웃바운드 호출은 이 레이어를 통해서만 수행한다.
 * UI / Controller 에서 직접 fetch 하지 않는다.
 */
@Injectable()
export class RentalClient {
  private readonly logger = new Logger(RentalClient.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('rental.baseUrl') || '';
  }

  private get apiKey(): string {
    return this.config.get<string>('rental.apiKey') || '';
  }

  private get timeoutMs(): number {
    return this.config.get<number>('rental.timeoutMs') || 10_000;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  async getOrder(orderId: string): Promise<RentalOrderRaw> {
    const template =
      this.config.get<string>('rental.orderPath') ||
      '/api/internal/orders/:orderId';
    const path = template.replace(':orderId', encodeURIComponent(orderId));
    return this.request<RentalOrderRaw>('GET', path);
  }

  async getProduct(productId: string): Promise<RentalProductRaw> {
    const template =
      this.config.get<string>('rental.productPath') ||
      '/api/internal/products/:productId';
    const path = template.replace(':productId', encodeURIComponent(productId));
    return this.request<RentalProductRaw>('GET', path);
  }

  /**
   * 검색 완료 Callback → BackOffice
   * Body: jobId, investigationCount, completedAt (+ optional keywordSummaries)
   * 기존 필드는 유지하고 키워드별 요약만 추가한다.
   */
  async postSearchCompletedCallback(payload: {
    jobId: string;
    investigationCount: number;
    completedAt: string;
    orderNo?: string | null;
    status?: 'completed' | 'partial';
    resultCount?: number;
    keywordSummaries?: Array<{
      keyword: string | null;
      status: string;
      resultCount: number;
      searchHistoryId: string;
    }>;
  }): Promise<void> {
    const path =
      this.config.get<string>('rental.callbackPath') ||
      '/api/internal/search-jobs/callback';
    await this.request<unknown>('POST', path, payload);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new RentalApiError(
        'RENTAL_API_BASE_URL 이 설정되지 않았습니다.',
        undefined,
        path,
      );
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      this.logger.debug(`Rental API ${method} ${url}`);
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.apiKey
            ? {
                'x-api-key': this.apiKey,
                Authorization: `Bearer ${this.apiKey}`,
              }
            : {}),
        },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new RentalApiError(
          `Rental API ${method} ${path} failed: ${response.status} ${text.slice(0, 200)}`,
          response.status,
          path,
        );
      }

      const text = await response.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof RentalApiError) throw error;
      const message =
        error instanceof Error ? error.message : String(error);
      throw new RentalApiError(
        `Rental API ${method} ${path} error: ${message}`,
        undefined,
        path,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
