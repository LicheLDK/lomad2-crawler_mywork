import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiteCode } from '@/common/constants/site-code';
import { parseListedAt } from '@/common/utils/listed-at.util';
import { BaseHttpAdapter } from './base-http.adapter';
import {
  NormalizedListing,
  SearchAdapterOptions,
} from './search-adapter.interface';

interface JsonLdListItem {
  '@type'?: string;
  position?: number;
  item?: {
    '@type'?: string;
    name?: string;
    description?: string;
    image?: string | string[];
    url?: string;
    offers?: {
      price?: string | number;
      seller?: { name?: string };
    };
  };
}

interface JsonLdItemList {
  '@type'?: string;
  itemListElement?: JsonLdListItem[];
}

interface FleamarketArticleJson {
  __typename?: string;
  id?: string;
  href?: string;
  price?: string | number;
  title?: string;
  thumbnail?: string;
  status?: string;
  content?: string;
  createdAt?: string;
  boostedAt?: string;
  user?: { nickname?: string };
  region?: { name?: string };
  locationName?: string | null;
}

/**
 * 검색 HTML에 임베드된 FleamarketArticle(Relay/GraphQL) 페이로드 추출.
 * JSON-LD ItemList 에는 createdAt 이 없어 등록일 확보용으로 우선 사용.
 */
export function extractFleamarketArticles(
  raw: string,
): Record<string, unknown>[] {
  const text = raw.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
  const marker = '"__typename":"FleamarketArticle"';
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  let from = 0;
  while (true) {
    const idx = text.indexOf(marker, from);
    if (idx < 0) break;
    from = idx + marker.length;

    // region/user 등 중첩 {"id": 를 건너뛰고 FleamarketArticle 루트 객체를 찾는다
    const obj = findFleamarketObject(text, idx);
    if (!obj) continue;

    const href =
      (typeof obj.href === 'string' && obj.href) ||
      (typeof obj.id === 'string' && obj.id.startsWith('/')
        ? `https://www.daangn.com${obj.id}`
        : '');
    if (!href || seen.has(href)) continue;
    seen.add(href);

    const title = String(obj.title || '').trim();
    if (!title) continue;

    items.push({
      name: title,
      price: obj.price ?? null,
      url: href,
      image: typeof obj.thumbnail === 'string' ? obj.thumbnail : null,
      seller: obj.user?.nickname ? String(obj.user.nickname) : null,
      description: obj.content != null ? String(obj.content) : null,
      region:
        (obj.region?.name && String(obj.region.name)) ||
        (obj.locationName ? String(obj.locationName) : null),
      createdAt: obj.createdAt || obj.boostedAt || null,
      status: obj.status ?? null,
      source: 'fleamarket_article',
    });
  }

  return items;
}

/** typename 위치 기준으로 뒤로 {"id": 후보를 올려가며 루트 FleamarketArticle 파싱 */
function findFleamarketObject(
  text: string,
  typenameIdx: number,
): FleamarketArticleJson | null {
  let cursor = typenameIdx;
  while (cursor > 0) {
    const start = text.lastIndexOf('{"id":', cursor);
    if (start < 0 || typenameIdx - start > 8000) return null;

    let depth = 0;
    let end = -1;
    const limit = Math.min(text.length, start + 16000);
    for (let i = start; i < limit; i++) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0 || end < typenameIdx) {
      cursor = start - 1;
      continue;
    }

    try {
      const obj = JSON.parse(
        text.slice(start, end + 1),
      ) as FleamarketArticleJson;
      if (obj.__typename === 'FleamarketArticle' && obj.title) {
        return obj;
      }
    } catch {
      // 다음 후보
    }
    cursor = start - 1;
  }
  return null;
}

/**
 * 당근(Karrot) Adapter
 * - /search/{q} 는 구식 → /kr/buy-sell/?search=
 * - 1순위: HTML 내 FleamarketArticle (createdAt·region 포함)
 * - 2순위: JSON-LD ItemList
 */
@Injectable()
export class KarrotAdapter extends BaseHttpAdapter {
  readonly siteCode = SiteCode.KARROT;
  readonly siteName = '당근';
  readonly ADAPTER_VERSION = '2';

  constructor(config: ConfigService) {
    super(config);
  }

  buildSearchUrl(options: SearchAdapterOptions): string {
    const q = encodeURIComponent(options.keyword);
    return `https://www.daangn.com/kr/buy-sell/?search=${q}`;
  }

  async parse(raw: string): Promise<Record<string, unknown>[]> {
    const fromEmbed = extractFleamarketArticles(raw);
    if (fromEmbed.length > 0) {
      this.logger.log(
        `[${this.siteCode}] FleamarketArticle hit n=${fromEmbed.length}`,
      );
      return fromEmbed;
    }

    const scripts = [
      ...raw.matchAll(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      ),
    ];

    for (const match of scripts) {
      try {
        const parsed = JSON.parse(match[1].trim()) as
          | JsonLdItemList
          | JsonLdItemList[];
        const docs = Array.isArray(parsed) ? parsed : [parsed];

        for (const doc of docs) {
          if (
            doc?.['@type'] !== 'ItemList' ||
            !Array.isArray(doc.itemListElement)
          ) {
            continue;
          }

          return doc.itemListElement
            .map((entry) => entry.item)
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .map((item) => ({
              name: item.name ?? '',
              description: item.description ?? null,
              image: Array.isArray(item.image) ? item.image[0] : item.image,
              url: item.url ?? '',
              price: item.offers?.price ?? null,
              seller: item.offers?.seller?.name ?? null,
              region: null,
              createdAt: null,
              source: 'json_ld',
            }));
        }
      } catch {
        // 다른 ld+json 블록 계속 시도
      }
    }

    this.logger.warn(`[${this.siteCode}] FleamarketArticle/JSON-LD not found`);
    return [];
  }

  mapItem(item: Record<string, unknown>): NormalizedListing {
    return {
      title: String(item.name || ''),
      price: this.parsePrice(item.price),
      seller: item.seller ? String(item.seller) : null,
      region: item.region ? String(item.region) : null,
      url: String(item.url || ''),
      imageUrl: item.image ? String(item.image) : null,
      description: item.description ? String(item.description) : null,
      listedAt: parseListedAt(item.createdAt),
      raw: item,
    };
  }
}
