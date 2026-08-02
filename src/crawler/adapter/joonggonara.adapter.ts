import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page } from 'playwright';
import { SiteCode } from '@/common/constants/site-code';
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

/**
 * 중고나라 Adapter
 * - 실제 DOM 셀렉터는 사이트 개편에 따라 조정 필요
 * - robots.txt / 이용약관 준수, 요청 속도 제한 적용
 */
@Injectable()
export class JoonggonaraAdapter extends BasePlaywrightAdapter {
  readonly siteCode = SiteCode.JOONGGONARA;
  readonly siteName = '중고나라';
  readonly ADAPTER_VERSION = '2';

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
        if (/^(판매|구매|찜|공유|신고|채팅|문의)하기(\s*버튼)?$/.test(s)) return true;
        if (/^[\d,]+원?$/.test(s)) return true;
        return false;
      }

      function pickTitle(root: Element, anchor: HTMLAnchorElement): string {
        const candidates: string[] = [];

        const img = root.querySelector('img');
        const alt = img?.getAttribute('alt')?.trim();
        if (alt) candidates.push(alt);

        // 카드 내 제목 후보 — 짧은 UI 문구보다 긴 상품명을 우선
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

        // 앵커 직계 자식 텍스트 (버튼 문구만 있는 경우 제외용)
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

        items.push({ title, priceText, href, image, seller, region });
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
      listedAt: null,
      raw: item,
    };
  }
}
