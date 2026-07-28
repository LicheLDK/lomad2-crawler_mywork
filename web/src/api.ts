const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ||
  'http://127.0.0.1:3100/api';

const KEY_STORAGE = 'crawler.dashboard.apiKey';

export function getApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) || 'change-me-api-key';
}

export function setApiKey(value: string) {
  localStorage.setItem(KEY_STORAGE, value);
}

/** API가 준 상대 경로(storage/...) 또는 절대 URL을 img src로 변환 */
export function resolveAssetUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.replace(/^\//, '');
  return `${API_BASE}/${clean}`;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options?: { allowErrorStatus?: boolean },
): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', getApiKey());
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok && !options?.allowErrorStatus) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () =>
    request<import('./types').HealthPayload>('/health', {}, { allowErrorStatus: true }),
  stats: () => request<import('./types').StatsOverview>('/stats'),
  aiUsageToday: () => request<import('./types').AiUsageToday>('/ai/usage/today'),
  search: (body: unknown) =>
    request<import('./types').SearchDetail>('/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  crawl: (body: unknown) =>
    request<{ searchId: string; status: string; jobId?: string; sites?: string[] }>(
      '/crawl',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),
  getSearch: (id: string) =>
    request<import('./types').SearchDetail>(`/search/${id}`),
  createSearchJob: (body: unknown) =>
    request<{
      jobId: string;
      orderNo: string;
      contractNo: string | null;
      status: string;
      requestedAt: string;
    }>('/search-jobs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getSearchJob: (id: string) =>
    request<{
      jobId: string;
      status: string;
      searchHistoryId: string | null;
      progress: number;
      currentSite: string | null;
      resultCount: number;
    }>(`/search-jobs/${id}`),
  getSearchJobProgress: (id: string) =>
    request<{
      jobId: string;
      status: string;
      currentSite: string | null;
      progress: number;
      resultCount: number;
      searchHistoryId: string | null;
      message?: string;
      at: string;
    }>(`/search-jobs/${id}/progress`),
  listRentalJobs: (limit = 40) =>
    request<{
      total: number;
      items: Array<{
        jobId: string;
        orderNo: string;
        status: string;
        progress: number;
        currentSite: string | null;
        resultCount: number;
        searchHistoryId: string | null;
        keywords: string[];
        requestedAt: string;
        finishedAt: string | null;
        investigationCount: number;
      }>;
    }>(`/search-jobs/rental/recent?limit=${limit}`),
  /** @deprecated use listRentalJobs */
  listRentalOrders: (limit = 40) =>
    request<{ total: number; items: unknown[] }>(
      `/search-jobs/rental/recent?limit=${limit}`,
    ),
  getRentalJob: (jobId: string) =>
    request<{
      job: {
        jobId: string;
        orderNo: string;
        status: string;
        progress: number;
        currentSite: string | null;
        resultCount: number;
        searchHistoryId: string | null;
        keywords: string[];
        requestedAt: string;
        finishedAt: string | null;
        errorMessage: string | null;
      };
      order: {
        orderNo: string;
        contractNo: string | null;
        customerName: string | null;
        productNo: string;
        productName: string;
        brand: string | null;
        modelName: string | null;
        option: string | null;
        color: string | null;
        imageUrl: string | null;
      } | null;
      orderError: string | null;
      searchHistories: Array<{
        searchHistoryId: string;
        jobId: string;
        keywords: string[];
        status: string;
        resultCount: number;
        requestedAt: string;
        finishedAt: string | null;
      }>;
      investigations: Array<{
        id: string;
        caseNo: string;
        productName: string;
        listingTitle?: string | null;
        aiScorePercent: number;
        status: string;
        priority: string;
        siteCode: string;
        searchHistoryId?: string | null;
        searchJobId?: string | null;
        createdAt: string;
      }>;
      investigationCount: number;
    }>(`/search-jobs/rental/jobs/${encodeURIComponent(jobId)}`),
  results: (params: URLSearchParams) =>
    request<{
      page: number;
      limit: number;
      total: number;
      items: import('./types').SearchResult[];
    }>(`/result?${params.toString()}`),
};
