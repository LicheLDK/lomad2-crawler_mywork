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

/** Search Job 키워드별 검색 내역 (search_job_histories) */
export interface KeywordHistoryItem {
  keyword: string | null;
  status: string;
  resultCount: number;
  searchHistoryId: string;
}

export interface StatsOverview {
  totals: { results: number; searches: number; keywords: number };
  last24h: { results: number; searches: number };
  bySite: { siteCode: string; count: number }[];
  /** crawl_site_attempts 집계 — GET /stats → siteMetrics */
  siteMetrics?: {
    hours: number;
    sites: {
      siteCode: string;
      totalAttempts: number;
      successCount: number;
      failCount: number;
      successRate: number | null;
      avgLatencyMs: number | null;
      p95LatencyMs: number | null;
    }[];
  };
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

/** AI usage 집계 버킷 — GET /ai/usage/* 공통 */
export interface AiUsageBucket {
  callCount: number;
  successCount: number;
  failureCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  avgResponseTimeMs: number;
  retryTotal: number;
}

export interface AiUsageToday extends AiUsageBucket {
  date: string;
}

export interface AiUsageMonthly extends AiUsageBucket {
  yearMonth: string;
}

export interface AiUsageByProvider extends AiUsageBucket {
  provider: string;
}

/** GET /ai/usage/summary */
export interface AiUsageSummary {
  today: AiUsageToday;
  month: AiUsageMonthly;
  byProvider: AiUsageByProvider[];
  currency: 'USD';
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

/** GET /queue/failed */
export interface FailedQueueJobItem {
  id: string;
  originalJobId: string;
  jobName: string;
  searchHistoryId: string;
  keyword: string;
  failedReason: string;
  failedAt: string;
  attemptsMade: number;
}

export interface FailedQueueJobsResponse {
  total: number;
  items: FailedQueueJobItem[];
}

/** POST /queue/:id/retry */
export interface RetryFailedQueueJobResponse {
  jobId: string;
}
