import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiteCode } from '@/common/constants/site-code';
import {
  isNationwideRegions,
  regionMatchesPresets,
  resolveSearchRegions,
} from '@/common/constants/search-region';
import { parseListedAt } from '@/common/utils/listed-at.util';
import { sleep } from '@/common/utils/string.util';
import { BaseHttpAdapter } from './base-http.adapter';
import {
  NormalizedListing,
  SearchAdapterOptions,
} from './search-adapter.interface';

/**
 * 번개장터 Adapter
 * - HTML 검색은 모바일 리다이렉트/404로 불안정 → 공개 JSON API(find_v2) 사용
 * - 검색 자체는 전국. regions 지정 시 location 문자열로 후필터
 */
@Injectable()
export class BungaeAdapter extends BaseHttpAdapter {
  readonly siteCode = SiteCode.BUNGAE;
  readonly siteName = '번개장터';
  readonly ADAPTER_VERSION = '3';

  constructor(config: ConfigService) {
    super(config);
  }

  buildSearchUrl(options: SearchAdapterOptions): string {
    const q = encodeURIComponent(options.keyword);
    const page = options.page ?? 0;
    const nationwide = isNationwideRegions(options.regions);
    const n = nationwide
      ? options.maxResults ?? 20
      : Math.min(100, Math.max(40, (options.maxResults ?? 20) * 5));
    return `https://api.bunjang.co.kr/api/1/find_v2.json?q=${q}&order=date&page=${page}&n=${n}&version=4`;
  }

  async parse(raw: string): Promise<Record<string, unknown>[]> {
    const data = JSON.parse(raw) as {
      list?: Array<Record<string, unknown>>;
    };
    return Array.isArray(data.list) ? data.list : [];
  }

  override async crawl(
    options: SearchAdapterOptions,
  ): Promise<NormalizedListing[]> {
    const max = options.maxResults ?? 20;
    const raw = await this.search(options);
    await sleep(this.config.get<number>('crawler.requestDelayMs') || 500);
    let listings = await this.normalize(await this.parse(raw));

    if (!isNationwideRegions(options.regions)) {
      const presets = resolveSearchRegions(options.regions);
      listings = listings.filter((l) =>
        regionMatchesPresets(l.region, presets),
      );
    }

    return listings.slice(0, max);
  }

  mapItem(item: Record<string, unknown>): NormalizedListing {
    const pid = item.pid != null ? String(item.pid) : '';
    const imageRaw = item.product_image ? String(item.product_image) : '';
    const imageUrl = imageRaw
      ? imageRaw.replace('{res}', '400')
      : null;

    return {
      title: String(item.name || ''),
      price: this.parsePrice(item.price),
      seller: null,
      region: item.location ? String(item.location) : null,
      url: pid ? `https://www.bunjang.co.kr/products/${pid}` : '',
      imageUrl,
      description: null,
      listedAt: parseListedAt(item.update_time ?? item.create_time),
      raw: item,
    };
  }
}
