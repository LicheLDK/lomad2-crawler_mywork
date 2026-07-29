import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page } from 'playwright';
import { SiteCode } from '@/common/constants/site-code';
import { BasePlaywrightAdapter } from './base-playwright.adapter';
import {
  NormalizedListing,
  SearchAdapterOptions,
} from './search-adapter.interface';

/**
 * 중고나라 Adapter
 * - 실제 DOM 셀렉터는 사이트 개편에 따라 조정 필요
 * - robots.txt / 이용약관 준수, 요청 속도 제한 적용
 */
@Injectable()
export class JoonggonaraAdapter extends BasePlaywrightAdapter {
  readonly siteCode = SiteCode.JOONGGONARA;
  readonly siteName = '중고나라';
  readonly ADAPTER_VERSION = '1';

  constructor(config: ConfigService) {
    super(config);
  }

  buildSearchUrl(options: SearchAdapterOptions): string {
    const q = encodeURIComponent(options.keyword);
    // Cafe/웹 검색 엔트리 (운영 시 실제 공개 검색 URL로 교체)
    return `https://web.joongna.com/search/${q}`;
  }

  protected async afterNavigate(page: Page): Promise<void> {
    await page.waitForTimeout(1000);
    // 무한 스크롤 대응 (최대 2회)
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(800);
    }
  }

  async extractItems(page: Page): Promise<Record<string, unknown>[]> {
    return page.evaluate(() => {
      const anchors = Array.from(
        document.querySelectorAll('a[href*="/product/"], a[href*="/detail/"]'),
      );

      const seen = new Set<string>();
      const items: Record<string, unknown>[] = [];

      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        if (!href || seen.has(href)) continue;
        seen.add(href);

        const root = a.closest('li, article, div') || a;
        const title =
          root.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() ||
          a.textContent?.trim() ||
          '';
        const priceText =
          root.querySelector('[class*="price"]')?.textContent?.trim() || null;
        const image =
          (root.querySelector('img') as HTMLImageElement | null)?.src || null;
        const seller =
          root.querySelector('[class*="nick"], [class*="seller"]')?.textContent
            ?.trim() || null;
        const region =
          root.querySelector('[class*="location"], [class*="region"]')
            ?.textContent?.trim() || null;

        if (!title) continue;
        items.push({ title, priceText, href, image, seller, region });
      }

      return items;
    });
  }

  mapItem(item: Record<string, unknown>): NormalizedListing {
    return {
      title: String(item.title || ''),
      price: this.parsePrice(item.priceText),
      seller: item.seller ? String(item.seller) : null,
      region: item.region ? String(item.region) : null,
      url: String(item.href || ''),
      imageUrl: item.image ? String(item.image) : null,
      description: null,
      listedAt: null,
      raw: item,
    };
  }
}
