import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { sleep } from '@/common/utils/string.util';
import {
  NormalizedListing,
  SearchAdapter,
  SearchAdapterOptions,
} from './search-adapter.interface';

export abstract class BasePlaywrightAdapter implements SearchAdapter {
  protected readonly logger: Logger;
  abstract readonly siteCode: string;
  abstract readonly siteName: string;

  private browser: Browser | null = null;

  constructor(protected readonly config: ConfigService) {
    this.logger = new Logger(this.constructor.name);
  }

  abstract buildSearchUrl(options: SearchAdapterOptions): string;
  abstract extractItems(page: Page): Promise<Record<string, unknown>[]>;
  abstract mapItem(item: Record<string, unknown>): NormalizedListing;

  async search(options: SearchAdapterOptions): Promise<string> {
    const page = await this.createPage();
    try {
      const url = this.buildSearchUrl(options);
      this.logger.log(`[${this.siteCode}] navigate: ${url}`);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.get<number>('crawler.navigationTimeoutMs'),
      });

      await this.afterNavigate(page);
      await sleep(this.config.get<number>('crawler.requestDelayMs') || 1500);

      return await page.content();
    } finally {
      await page.context().close();
    }
  }

  async parse(raw: string): Promise<Record<string, unknown>[]> {
    // 기본 구현: Playwright로 다시 열어 추출. 사이트별 오버라이드 가능.
    const page = await this.createPage();
    try {
      await page.setContent(raw, { waitUntil: 'domcontentloaded' });
      return await this.extractItems(page);
    } finally {
      await page.context().close();
    }
  }

  async normalize(
    items: Record<string, unknown>[],
  ): Promise<NormalizedListing[]> {
    return items
      .map((item) => this.mapItem(item))
      .filter((item) => Boolean(item.url) && Boolean(item.title));
  }

  /** search → parse → normalize 원샷 */
  async crawl(options: SearchAdapterOptions): Promise<NormalizedListing[]> {
    const page = await this.createPage();
    try {
      const url = this.buildSearchUrl(options);
      this.logger.log(`[${this.siteCode}] crawl: ${url}`);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.get<number>('crawler.navigationTimeoutMs'),
      });

      await this.afterNavigate(page);
      await sleep(this.config.get<number>('crawler.requestDelayMs') || 1500);

      const items = await this.extractItems(page);
      const max = options.maxResults ?? 20;
      return this.normalize(items.slice(0, max));
    } finally {
      await page.context().close();
    }
  }

  protected async afterNavigate(_page: Page): Promise<void> {
    // 사이트별 로그인/스크롤 등 훅
  }

  protected async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const proxyUrl = this.config.get<string>('crawler.proxyUrl');
    const context: BrowserContext = await browser.newContext({
      userAgent: this.config.get<string>('crawler.userAgent'),
      viewport: { width: 1366, height: 768 },
      locale: 'ko-KR',
      ...(proxyUrl ? { proxy: { server: proxyUrl } } : {}),
    });

    const page = await context.newPage();
    page.setDefaultTimeout(this.config.get<number>('crawler.timeoutMs') || 30000);
    return page;
  }

  protected async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: this.config.get<boolean>('crawler.headless') !== false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async dispose(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  protected parsePrice(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.round(value);
    }
    const normalized = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!normalized) return null;
    const n = Number(normalized[0]);
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
  }
}
