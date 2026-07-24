import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiteCode } from '@/common/constants/site-code';
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

/**
 * 당근(Karrot) Adapter
 * - /search/{q} 는 구식 → /kr/buy-sell/?search= + JSON-LD ItemList 파싱
 */
@Injectable()
export class KarrotAdapter extends BaseHttpAdapter {
  readonly siteCode = SiteCode.KARROT;
  readonly siteName = '당근';

  constructor(config: ConfigService) {
    super(config);
  }

  buildSearchUrl(options: SearchAdapterOptions): string {
    const q = encodeURIComponent(options.keyword);
    return `https://www.daangn.com/kr/buy-sell/?search=${q}`;
  }

  async parse(raw: string): Promise<Record<string, unknown>[]> {
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
          if (doc?.['@type'] !== 'ItemList' || !Array.isArray(doc.itemListElement)) {
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
            }));
        }
      } catch {
        // 다른 ld+json 블록 계속 시도
      }
    }

    this.logger.warn(`[${this.siteCode}] JSON-LD ItemList not found`);
    return [];
  }

  mapItem(item: Record<string, unknown>): NormalizedListing {
    return {
      title: String(item.name || ''),
      price: this.parsePrice(item.price),
      seller: item.seller ? String(item.seller) : null,
      region: null,
      url: String(item.url || ''),
      imageUrl: item.image ? String(item.image) : null,
      description: item.description ? String(item.description) : null,
      listedAt: null,
      raw: item,
    };
  }
}
