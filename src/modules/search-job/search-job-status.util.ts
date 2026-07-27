import { SearchJobStatus } from '@/database/entities/search-job.entity';
import { CrawlProgressEvent } from '@/progress/crawl-progress.types';

export type SearchJobProgressFields = {
  status: SearchJobStatus;
  progress: number;
  currentSite: string | null;
  resultCount: number;
  finishedAt: Date | null;
  errorMessage: string | null;
};

export function clampProgress(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * 크롤 progress 이벤트를 SearchJob 필드에 반영한다.
 * queued → running → completed/failed 전이를 한곳에서 고정한다.
 */
export function applyCrawlProgressToJob(
  job: SearchJobProgressFields,
  crawl: CrawlProgressEvent,
): void {
  job.progress = clampProgress(crawl.percent);
  job.currentSite = crawl.currentSite;
  job.resultCount = crawl.resultCount ?? job.resultCount;

  if (crawl.status === 'failed') {
    job.status = SearchJobStatus.FAILED;
    job.finishedAt = new Date();
    job.errorMessage = crawl.message || 'Search failed';
    return;
  }

  if (crawl.status === 'completed' || crawl.status === 'partial') {
    job.status = SearchJobStatus.COMPLETED;
    job.finishedAt = new Date();
    job.progress = 100;
    job.currentSite = null;
    return;
  }

  if (crawl.status === 'running' || crawl.status === 'queued') {
    if (
      job.status !== SearchJobStatus.FAILED &&
      job.status !== SearchJobStatus.COMPLETED
    ) {
      job.status =
        crawl.status === 'queued'
          ? SearchJobStatus.QUEUED
          : SearchJobStatus.RUNNING;
    }
  }
}
