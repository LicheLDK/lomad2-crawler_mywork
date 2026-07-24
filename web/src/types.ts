export type SiteCode = 'joonggonara' | 'bungae' | 'karrot';

export interface SearchResult {
  id: string;
  searchHistoryId?: string;
  siteCode: string;
  title: string;
  price: string | null;
  seller: string | null;
  region: string | null;
  url: string;
  imageUrl: string | null;
  /** 크롤링 시 서버에 저장된 이미지 (API 상대경로 storage/images/:id) */
  screenshotUrl?: string | null;
  description?: string | null;
  titleSimilarity?: number | null;
  imageSimilarity?: number | null;
  createdAt?: string;
  source?: string;
}

export interface SearchDetail {
  searchId: string;
  keyword: string;
  status: string;
  resultCount: number;
  sites: string[] | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  results: SearchResult[];
  /** 검색 시 전달한 렌탈 상품 이미지 (requestMeta) */
  referenceImageUrl?: string | null;
  source?: string;
  jobId?: string;
}

export interface StatsOverview {
  totals: { results: number; searches: number; keywords: number };
  last24h: { results: number; searches: number };
  bySite: { siteCode: string; count: number }[];
  byStatus: { status: string; count: number }[];
  topKeywords: {
    keyword: string;
    searchCount: number;
    lastSearchedAt: string | null;
  }[];
  recentSearches: {
    searchId: string;
    keyword: string;
    status: string;
    resultCount: number;
    sites: string[] | null;
    createdAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
  }[];
  searchTrend?: {
    day: string;
    searches: number;
    results: number;
  }[];
  queue: Record<string, number> | null;
  generatedAt: string;
}

export interface HealthPayload {
  status?: string;
  info?: {
    postgres?: { status?: string };
    elasticsearch?: { status?: string };
    redis?: { status?: string };
    queue?: Record<string, number>;
  };
}
