import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sleep } from '@/common/utils/string.util';
import {
  CrawlAdapterError,
  isTimeoutLike,
} from './crawl-adapter.error';
import {
  NormalizedListing,
  SearchAdapter,
  SearchAdapterOptions,
} from './search-adapter.interface';

/**
 * Playwright 없이 HTTP(fetch)로 수집하는 Adapter 베이스
 */
export abstract class BaseHttpAdapter implements SearchAdapter {
  protected readonly logger: Logger;
  abstract readonly siteCode: string;
  abstract readonly siteName: string;
  abstract readonly ADAPTER_VERSION: string;

  constructor(protected readonly config: ConfigService) {
    this.logger = new Logger(this.constructor.name);
  }

  abstract buildSearchUrl(options: SearchAdapterOptions): string;
  abstract parse(raw: string): Promise<Record<string, unknown>[]>;
  abstract mapItem(item: Record<string, unknown>): NormalizedListing;

  async search(options: SearchAdapterOptions): Promise<string> {
    const url = this.buildSearchUrl(options);
    this.logger.log(`[${this.siteCode}] fetch: ${url}`);
    return this.fetchText(url);
  }

  async normalize(
    items: Record<string, unknown>[],
  ): Promise<NormalizedListing[]> {
    return items
      .map((item) => this.mapItem(item))
      .filter((item) => Boolean(item.url) && Boolean(item.title));
  }

  async crawl(options: SearchAdapterOptions): Promise<NormalizedListing[]> {
    const raw = await this.search(options);
    await sleep(this.config.get<number>('crawler.requestDelayMs') || 500);
    const items = await this.parse(raw);
    const max = options.maxResults ?? 20;
    return this.normalize(items.slice(0, max));
  }

  async dispose(): Promise<void> {
    // HTTP adapter — no browser to close
  }

  protected async fetchText(url: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent':
            this.config.get<string>('crawler.userAgent') ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/html, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(
          this.config.get<number>('crawler.timeoutMs') || 30000,
        ),
      });
    } catch (error) {
      if (isTimeoutLike(error)) {
        throw new CrawlAdapterError({
          message: `[${this.siteCode}] TIMEOUT for ${url}`,
          errorCode: 'TIMEOUT',
          cause: error,
        });
      }
      throw error;
    }

    if (!response.ok) {
      throw new CrawlAdapterError({
        message: `[${this.siteCode}] HTTP ${response.status} for ${url}`,
        errorCode: `HTTP_${response.status}`,
        responseStatus: response.status,
      });
    }

    return response.text();
  }

  protected parsePrice(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.round(value);
    }
    // "200000.0" / "1,200,000원" 등 — 소수점은 정수 원 단위로 반올림
    const normalized = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!normalized) return null;
    const n = Number(normalized[0]);
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
  }
}
