export const CRAWL_PROGRESS_CHANNEL = 'crawler:progress';

export type CrawlProgressStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed';

export interface CrawlProgressEvent {
  searchId: string;
  keyword: string;
  status: CrawlProgressStatus;
  percent: number;
  currentSite: string | null;
  completedSites: string[];
  pendingSites: string[];
  resultCount: number;
  totalSites: number;
  message?: string;
  at: string;
}
