export const SEARCH_JOB_PROGRESS_CHANNEL = 'crawler:job-progress';

/** Search Job Progress API / WebSocket payload */
export interface SearchJobProgressEvent {
  jobId: string;
  searchHistoryId: string | null;
  status: string;
  currentSite: string | null;
  /** 0~100 */
  progress: number;
  resultCount: number;
  message?: string;
  at: string;
}
