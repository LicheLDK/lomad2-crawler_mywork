import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiteCode } from '@/common/constants/site-code';
import { parseListedAt } from '@/common/utils/listed-at.util';
import { BaseHttpAdapter } from './base-http.adapter';
import {
  NormalizedListing,
  SearchAdapterOptions,
} from './search-adapter.interface';

/**
 * 번개장터 Adapter
 * - HTML 검색은 모바일 리다이렉트/404로 불안정 → 공개 JSON API(find_v2) 사용
 */
@Injectable()
export class BungaeAdapter extends BaseHttpAdapter {
  readonly siteCode = SiteCode.BUNGAE;
  readonly siteName = '번개장터';
  readonly ADAPTER_VERSION = '2';

  constructor(config: ConfigService) {
    super(config);
  }

  buildSearchUrl(options: SearchAdapterOptions): string {
    const q = encodeURIComponent(options.keyword);
    const page = options.page ?? 0;
    const n = options.maxResults ?? 20;
    return `https://api.bunjang.co.kr/api/1/find_v2.json?q=${q}&order=score&page=${page}&n=${n}&version=4`;
  }

  async parse(raw: string): Promise<Record<string, unknown>[]> {
    const data = JSON.parse(raw) as {
      list?: Array<Record<string, unknown>>;
    };
    return Array.isArray(data.list) ? data.list : [];
  }

  mapItem(item: Record<string, unknown>): NormalizedListing {
    const pid = item.pid != null ? String(item.pid) : '';
    const imageRaw = item.product_image ? String(item.product_image) : '';
    // API 이미지는 `{res}` 플레이스홀더 포함
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
      // find_v2: update_time = 유닉스 초 (끌어올리기 반영 시각)
      listedAt: parseListedAt(item.update_time ?? item.create_time),
      raw: item,
    };
  }
}
