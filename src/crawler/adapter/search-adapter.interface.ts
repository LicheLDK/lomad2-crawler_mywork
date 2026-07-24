export interface NormalizedListing {
  title: string;
  price: number | null;
  seller: string | null;
  region: string | null;
  url: string;
  imageUrl: string | null;
  description: string | null;
  listedAt: Date | null;
  raw?: Record<string, unknown>;
}

export interface SearchAdapterOptions {
  keyword: string;
  maxResults?: number;
  page?: number;
}

export interface SearchAdapter {
  readonly siteCode: string;
  readonly siteName: string;

  /** 검색 페이지 진입 및 HTML/데이터 수집 */
  search(options: SearchAdapterOptions): Promise<string>;

  /** HTML 또는 JSON 파싱 */
  parse(raw: string): Promise<Record<string, unknown>[]>;

  /** 공통 스키마로 정규화 */
  normalize(items: Record<string, unknown>[]): Promise<NormalizedListing[]>;

  /** search → parse → normalize 원샷 */
  crawl(options: SearchAdapterOptions): Promise<NormalizedListing[]>;

  /** 브라우저 등 리소스 정리 (선택) */
  dispose?(): Promise<void>;
}
