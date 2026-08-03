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
  /**
   * 광역 지역 코드 (seoul, gyeonggi, …).
   * 비어 있거나 'all' 포함 시 전체 광역.
   */
  regions?: string[];
}

export interface SearchAdapter {
  readonly siteCode: string;
  readonly siteName: string;
  /** 배포마다 올리는 어댑터 버전 (attempt 기록용, B7) */
  readonly ADAPTER_VERSION: string;

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
