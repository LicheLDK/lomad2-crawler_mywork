import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page } from 'playwright';
import { SiteCode } from '@/common/constants/site-code';
import { parseListedAt } from '@/common/utils/listed-at.util';
import { sleep } from '@/common/utils/string.util';
import {
  CrawlAdapterError,
  isTimeoutLike,
} from './crawl-adapter.error';
import { BasePlaywrightAdapter } from './base-playwright.adapter';
import {
  NormalizedListing,
  SearchAdapterOptions,
} from './search-adapter.interface';

/** 중고나라 UI 크롬 — 매물 제목으로 쓰면 안 되는 문구 */
export const JOONGNA_JUNK_TITLES = new Set([
  '판매하기',
  '구매하기',
  '찜하기',
  '공유하기',
  '신고하기',
  '앱 다운로드',
  '키워드 알림 받기',
  '더보기',
  '판매완료',
  '무료배송',
  '인증셀러',
  '최근 본 상품',
  '검색결과',
  '추천순',
  '최신순',
  '낮은가격순',
  '높은가격순',
  '채팅하기',
  '문의하기',
]);

export function isJunkJoongnaTitle(title: string): boolean {
  const s = title.replace(/\s+/g, ' ').trim();
  if (!s || s.length < 2) return true;
  if (JOONGNA_JUNK_TITLES.has(s)) return true;
  // "판매하기 버튼", "채팅하기 버튼" 등 — 아이콘 버튼의 접근성 라벨(aria-label/alt)
  if (/^(판매|구매|찜|공유|신고|채팅|문의)하기(\s*버튼)?$/.test(s)) return true;
  if (/^[\d,]+원?$/.test(s)) return true;
  return false;
}

/** 검색 API / RSC item → 공통 raw item */
export function mapJoongnaApiItem(
  it: Record<string, unknown>,
): Record<string, unknown> | null {
  const seq = it.seq != null ? Number(it.seq) : NaN;
  if (!Number.isFinite(seq)) return null;

  const rawTitle = String(it.title || '').replace(/\s+/g, ' ').trim();
  if (!rawTitle || isJunkJoongnaTitle(rawTitle)) return null;

  const locations = Array.isArray(it.locationNames)
    ? (it.locationNames as unknown[])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    : [];
  const region =
    (typeof it.mainLocationName === 'string' && it.mainLocationName.trim()
      ? it.mainLocationName.trim()
      : null) ||
    locations[0] ||
    null;

  return {
    title: rawTitle,
    priceText: it.price != null ? `${it.price}원` : null,
    href: `https://web.joongna.com/product/${seq}`,
    image: typeof it.url === 'string' ? it.url : null,
    seller: null,
    region,
    sortDate: typeof it.sortDate === 'string' ? it.sortDate : null,
    source: 'search_api',
  };
}

/**
 * 중고나라 Adapter
 * - 1순위: search-api.joongna.com (sortDate=등록시각 포함)
 * - 2순위: Playwright DOM / RSC fallback
 */
@Injectable()
export class JoonggonaraAdapter extends BasePlaywrightAdapter {
  readonly siteCode = SiteCode.JOONGGONARA;
  readonly siteName = '중고나라';
  readonly ADAPTER_VERSION = '4';

  constructor(config: ConfigService) {
    super(config);
  }

  buildSearchUrl(options: SearchAdapterOptions): string {
    const q = encodeURIComponent(options.keyword);
    return `https://web.joongna.com/search/${q}`;
  }

  /** API 우선, 실패/빈 결과 시 Playwright */
  override async crawl(
    options: SearchAdapterOptions,
  ): Promise<NormalizedListing[]> {
    const max = options.maxResults ?? 20;
    try {
      const apiItems = await this.fetchSearchApi(options);
      if (apiItems.length > 0) {
        this.logger.log(
          `[${this.siteCode}] search-api hit n=${apiItems.length}`,
        );
        return this.normalize(apiItems.slice(0, max));
      }
      this.logger.warn(
        `[${this.siteCode}] search-api empty — Playwright fallback`,
      );
    } catch (error) {
      this.logger.warn(
        `[${this.siteCode}] search-api failed — Playwright fallback: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return super.crawl(options);
  }

  private async fetchSearchApi(
    options: SearchAdapterOptions,
  ): Promise<Record<string, unknown>[]> {
    const size = Math.max(options.maxResults ?? 20, 20);
    // page 는 0-based. searchWord 가 키워드 파라미터.
    const url = 'https://search-api.joongna.com/v3/search/all';
    const body = {
      searchWord: options.keyword,
      page: options.page ?? 0,
      size,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent':
            this.config.get<string>('crawler.userAgent') ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Origin: 'https://web.joongna.com',
          Referer: 'https://web.joongna.com/',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        body: JSON.stringify(body),
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

    await sleep(this.config.get<number>('crawler.requestDelayMs') || 300);

    const json = (await response.json()) as {
      meta?: { code?: number };
      data?: { items?: Record<string, unknown>[] };
    };
    if (json.meta?.code != null && json.meta.code !== 0) {
      throw new CrawlAdapterError({
        message: `[${this.siteCode}] search-api meta.code=${json.meta.code}`,
        errorCode: 'PARSE_EMPTY',
      });
    }

    const items = Array.isArray(json.data?.items) ? json.data!.items! : [];
    return items
      .map((it) => mapJoongnaApiItem(it))
      .filter((it): it is Record<string, unknown> => it != null);
  }

  protected async afterNavigate(page: Page): Promise<void> {
    await page.waitForTimeout(1000);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(800);
    }
  }

  async extractItems(page: Page): Promise<Record<string, unknown>[]> {
    return page.evaluate(() => {
      const junkExact = new Set([
        '판매하기',
        '구매하기',
        '찜하기',
        '공유하기',
        '신고하기',
        '앱 다운로드',
        '키워드 알림 받기',
        '더보기',
        '판매완료',
        '무료배송',
        '인증셀러',
        '최근 본 상품',
        '검색결과',
        '추천순',
        '최신순',
        '낮은가격순',
        '높은가격순',
        '채팅하기',
        '문의하기',
      ]);

      function isJunk(title: string): boolean {
        const s = title.replace(/\s+/g, ' ').trim();
        if (!s || s.length < 2) return true;
        if (junkExact.has(s)) return true;
        if (/^(판매|구매|찜|공유|신고|채팅|문의)하기(\s*버튼)?$/.test(s))
          return true;
        if (/^[\d,]+원?$/.test(s)) return true;
        return false;
      }

      function flattenNextF(chunks: unknown[]): string {
        const parts: string[] = [];
        const walk = (x: unknown) => {
          if (typeof x === 'string') {
            parts.push(x);
            return;
          }
          if (Array.isArray(x)) {
            for (const y of x) walk(y);
            return;
          }
          if (x != null && typeof x === 'object') {
            parts.push(JSON.stringify(x));
          }
        };
        for (const c of chunks) walk(c);
        return parts.join('\n');
      }

      function extractFromNextFlight(): Record<string, unknown>[] {
        const w = window as unknown as { __next_f?: unknown[] };
        const text = flattenNextF(w.__next_f || [])
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');

        const marker = '"items":[';
        const start = text.indexOf(marker);
        if (start < 0) return [];

        let i = start + marker.length - 1;
        let depth = 0;
        let end = -1;
        for (; i < text.length; i++) {
          const ch = text[i];
          if (ch === '[') depth++;
          else if (ch === ']') {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        if (end < 0) return [];

        try {
          const arr = JSON.parse(
            text.slice(start + marker.length - 1, end + 1),
          ) as unknown;
          if (!Array.isArray(arr)) return [];
          return arr
            .filter(
              (it): it is Record<string, unknown> =>
                !!it &&
                typeof it === 'object' &&
                typeof (it as { seq?: unknown }).seq === 'number',
            )
            .map((it) => {
              const seq = Number(it.seq);
              const locations = Array.isArray(it.locationNames)
                ? (it.locationNames as unknown[])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean)
                : [];
              const region =
                (typeof it.mainLocationName === 'string' &&
                it.mainLocationName.trim()
                  ? it.mainLocationName.trim()
                  : null) ||
                locations[0] ||
                null;
              return {
                title: String(it.title || ''),
                priceText: it.price != null ? `${it.price}원` : null,
                href: `https://web.joongna.com/product/${seq}`,
                image: typeof it.url === 'string' ? it.url : null,
                seller: null,
                region,
                sortDate:
                  typeof it.sortDate === 'string' ? it.sortDate : null,
                source: 'next_f',
              };
            })
            .filter((it) => it.title && !isJunk(it.title));
        } catch {
          return [];
        }
      }

      function pickTitle(root: Element, anchor: HTMLAnchorElement): string {
        const candidates: string[] = [];
        const img = root.querySelector('img');
        const alt = img?.getAttribute('alt')?.trim();
        if (alt) candidates.push(alt);

        for (const sel of [
          '[class*="productName"]',
          '[class*="ProductName"]',
          '[class*="item-title"]',
          '[class*="ItemTitle"]',
          'h2',
          'h3',
        ]) {
          for (const el of Array.from(root.querySelectorAll(sel))) {
            const t = el.textContent?.replace(/\s+/g, ' ').trim();
            if (t) candidates.push(t);
          }
        }

        for (const child of Array.from(anchor.children)) {
          const t = child.textContent?.replace(/\s+/g, ' ').trim();
          if (t && t.length < 120) candidates.push(t);
        }

        const linkText = anchor.textContent?.replace(/\s+/g, ' ').trim();
        if (linkText && linkText.length < 120) candidates.push(linkText);

        const scored = [...new Set(candidates)]
          .map((c) => c.replace(/\s+/g, ' ').trim())
          .filter((c) => c && !isJunk(c) && c.length <= 200)
          .sort((a, b) => b.length - a.length);

        return scored[0] || '';
      }

      function pickTimeText(root: Element): string | null {
        const timeEl = root.querySelector(
          'time, [datetime], [class*="time"], [class*="Time"], [class*="date"], [class*="Date"], [class*="ago"]',
        );
        if (timeEl) {
          const dt = timeEl.getAttribute('datetime');
          if (dt) return dt;
          const t = timeEl.textContent?.replace(/\s+/g, ' ').trim();
          if (t) return t;
        }
        const texts = Array.from(root.querySelectorAll('span, p, time, div'))
          .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() || '')
          .filter(Boolean);
        for (const t of texts) {
          if (
            /^(방금(?:\s*전)?|\d+\s*(초|분|시간|일|주|개월|달|년)\s*전|어제|\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2})$/.test(
              t,
            )
          ) {
            return t;
          }
        }
        return null;
      }

      const fromFlight = extractFromNextFlight();
      if (fromFlight.length > 0) return fromFlight;

      const anchors = Array.from(
        document.querySelectorAll('a[href*="/product/"], a[href*="/detail/"]'),
      );

      const seen = new Set<string>();
      const items: Record<string, unknown>[] = [];

      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        if (!href || seen.has(href)) continue;
        if (/\/product\/form/i.test(href)) continue;
        seen.add(href);

        const root = a.closest('li, article, div') || a;
        const title = pickTitle(root, a as HTMLAnchorElement);
        if (!title || isJunk(title)) continue;

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

        items.push({
          title,
          priceText,
          href,
          image,
          seller,
          region,
          sortDate: pickTimeText(root),
          source: 'dom',
        });
      }

      return items;
    });
  }

  mapItem(item: Record<string, unknown>): NormalizedListing {
    const rawTitle = String(item.title || '').replace(/\s+/g, ' ').trim();
    const title = isJunkJoongnaTitle(rawTitle) ? '' : rawTitle;
    return {
      title,
      price: this.parsePrice(item.priceText),
      seller: item.seller ? String(item.seller) : null,
      region: item.region ? String(item.region) : null,
      url: String(item.href || ''),
      imageUrl: item.image ? String(item.image) : null,
      description: null,
      listedAt: parseListedAt(item.sortDate),
      raw: item,
    };
  }
}
