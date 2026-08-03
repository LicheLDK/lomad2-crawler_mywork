import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiteCode } from '@/common/constants/site-code';
import { resolveKarrotIns } from '@/common/constants/search-region';
import { parseListedAt } from '@/common/utils/listed-at.util';
import { selectTopByTitleSimilarity, sleep } from '@/common/utils/string.util';
import {
  CrawlAdapterError,
} from './crawl-adapter.error';
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
 * - /search/{q} 는 구식 → /kr/buy-sell/?in=동네&search=
 * - 시·도/시 단위 in= 은 반경 제한으로 누락 → 읍·면 위주 다중 크롤
 * - 과도한 병렬 호출 시 403 차단 → 낮은 동시성 + 백오프
 * - 1순위: HTML 내 FleamarketArticle (createdAt·region 포함)
 * - 2순위: JSON-LD ItemList
 */
@Injectable()
export class KarrotAdapter extends BaseHttpAdapter {
  readonly siteCode = SiteCode.KARROT;
  readonly siteName = '당근';
  readonly ADAPTER_VERSION = '6';

  constructor(config: ConfigService) {
    super(config);
  }

  buildSearchUrl(options: SearchAdapterOptions & { karrotIn?: string }): string {
    const q = encodeURIComponent(options.keyword);
    const karrotIn =
      options.karrotIn || resolveKarrotIns(options.regions)[0];
    if (karrotIn) {
      return `https://www.daangn.com/kr/buy-sell/?in=${encodeURIComponent(karrotIn)}&search=${q}`;
    }
    return `https://www.daangn.com/kr/buy-sell/?search=${q}`;
  }

  /**
   * 동네 in= 순차/소량 병렬 수집 → URL 합친 뒤 유사도 상위 후보 반환.
   * 최종 maxKeep 재선별은 crawler.service 에서 한 번 더 한다.
   */
  override async crawl(
    options: SearchAdapterOptions,
  ): Promise<NormalizedListing[]> {
    const max = options.maxResults ?? 20;
    const targets = shuffle(resolveKarrotIns(options.regions));
    const merged: NormalizedListing[] = [];
    const seen = new Set<string>();

    let concurrency = 2;
    const baseDelayMs = Math.max(
      this.config.get<number>('crawler.requestDelayMs') || 500,
      500,
    );
    let delayMs = baseDelayMs;
    let consecutiveForbidden = 0;
    let forbiddenCount = 0;
    let successCount = 0;
    let aborted = false;

    for (let i = 0; i < targets.length; i += concurrency) {
      if (aborted) break;

      const batch = targets.slice(i, i + concurrency);
      const lists = await Promise.all(
        batch.map(async (karrotIn) => {
          try {
            const raw = await this.fetchText(
              this.buildSearchUrl({
                keyword: options.keyword,
                karrotIn,
              }),
            );
            const items = await this.parse(raw);
            return { ok: true as const, items: await this.normalize(items) };
          } catch (error) {
            const status =
              error instanceof CrawlAdapterError
                ? error.responseStatus
                : null;
            return {
              ok: false as const,
              status,
              message:
                error instanceof Error ? error.message : String(error),
              karrotIn,
            };
          }
        }),
      );

      for (const result of lists) {
        if (result.ok) {
          consecutiveForbidden = 0;
          successCount += 1;
          for (const item of result.items) {
            if (seen.has(item.url)) continue;
            seen.add(item.url);
            merged.push(item);
          }
          continue;
        }

        if (result.status === 403 || result.status === 429) {
          forbiddenCount += 1;
          consecutiveForbidden += 1;
        } else {
          consecutiveForbidden = 0;
          this.logger.warn(
            `[${this.siteCode}] in=${result.karrotIn} failed: ${result.message}`,
          );
        }
      }

      if (consecutiveForbidden >= 4) {
        concurrency = 1;
        delayMs = Math.min(delayMs * 2, 8000);
        this.logger.warn(
          `[${this.siteCode}] rate-limited (403/429) — backoff ${delayMs}ms, concurrency=1`,
        );
        await sleep(delayMs);
      }

      // 연속 차단이 길면 부분 결과로 조기 종료 (추가 차단·빈 결과 악화 방지)
      if (consecutiveForbidden >= 10) {
        aborted = true;
        this.logger.warn(
          `[${this.siteCode}] abort remaining targets after repeated 403/429 (have=${merged.length})`,
        );
        break;
      }

      if (i + concurrency < targets.length && !aborted) {
        await sleep(delayMs);
      }
    }

    this.logger.log(
      `[${this.siteCode}] multi-region n=${merged.length} targets=${targets.length} ok=${successCount} forbidden=${forbiddenCount} aborted=${aborted}`,
    );

    if (merged.length === 0 && forbiddenCount > 0 && successCount === 0) {
      throw new CrawlAdapterError({
        message:
          '당근에서 일시적으로 검색을 차단했습니다. 2~3분 기다린 뒤 다시 검색해 주세요. 연속으로 시도하면 차단이 더 길어질 수 있습니다.',
        errorCode: 'HTTP_403',
        responseStatus: 403,
      });
    }

    if (aborted && merged.length > 0) {
      this.logger.warn(
        `[${this.siteCode}] partial due to rate-limit have=${merged.length} forbidden=${forbiddenCount}`,
      );
    }

    // 최신순이 아니라 제목 유사도 우선으로 후보를 남긴다
    return selectTopByTitleSimilarity(options.keyword, merged, max);
  }

  async parse(raw: string): Promise<Record<string, unknown>[]> {
    const fromEmbed = extractFleamarketArticles(raw);
    if (fromEmbed.length > 0) {
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

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
