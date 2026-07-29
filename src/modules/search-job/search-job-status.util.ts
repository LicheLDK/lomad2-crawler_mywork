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

/** 키워드(히스토리) 단위 종료 상태 */
export const TERMINAL_HISTORY_STATUSES = new Set([
  'completed',
  'partial',
  'failed',
  'cached',
  'timeout',
]);

/** 키워드 단위 성공으로 보는 상태 (크롤 partial 포함) */
export const SUCCESS_HISTORY_STATUSES = new Set([
  'completed',
  'partial',
  'cached',
]);

/** 키워드 단위 실패 */
export const FAILURE_HISTORY_STATUSES = new Set(['failed', 'timeout']);

export function clampProgress(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isTerminalHistoryStatus(status: string): boolean {
  return TERMINAL_HISTORY_STATUSES.has(status);
}

export function isSuccessfulHistoryStatus(status: string): boolean {
  return SUCCESS_HISTORY_STATUSES.has(status);
}

export function isFailureHistoryStatus(status: string): boolean {
  return FAILURE_HISTORY_STATUSES.has(status);
}

/**
 * A4 부분 실패 판정.
 * 전부 성공 → completed / 일부 실패·타임아웃 → partial / 전부 실패 → failed
 */
export function resolveJobStatusFromHistories(
  statuses: string[],
): SearchJobStatus {
  if (statuses.length === 0) return SearchJobStatus.FAILED;

  const successCount = statuses.filter(isSuccessfulHistoryStatus).length;
  const failureCount = statuses.filter(isFailureHistoryStatus).length;

  if (successCount === statuses.length) return SearchJobStatus.COMPLETED;
  if (failureCount === statuses.length) return SearchJobStatus.FAILED;
  if (successCount > 0) return SearchJobStatus.PARTIAL;
  return SearchJobStatus.FAILED;
}

/**
 * 키워드 N개에 걸쳐 진행률을 합산한다.
 * 종료 행=100, 진행 중이면 percent(없으면 running=50 / 그 외=10).
 */
export function aggregateJobProgress(
  items: Array<{ status: string; percent?: number | null }>,
): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, item) => {
    if (isTerminalHistoryStatus(item.status)) return acc + 100;
    if (item.percent != null && Number.isFinite(item.percent)) {
      return acc + clampProgress(item.percent);
    }
    if (item.status === 'running') return acc + 50;
    return acc + 10;
  }, 0);
  return clampProgress(sum / items.length);
}

/**
 * 단일 크롤 progress를 Job 진행 필드에 반영한다.
 * Job 완료/실패 판정은 하지 않는다 — 다중 키워드는 finalize 경로가 담당한다.
 */
export function applyCrawlProgressToJob(
  job: SearchJobProgressFields,
  crawl: CrawlProgressEvent,
): void {
  job.progress = clampProgress(crawl.percent);
  job.currentSite = crawl.currentSite;
  job.resultCount = crawl.resultCount ?? job.resultCount;

  if (
    job.status === SearchJobStatus.FAILED ||
    job.status === SearchJobStatus.COMPLETED ||
    job.status === SearchJobStatus.PARTIAL
  ) {
    return;
  }

  if (crawl.status === 'running' || crawl.status === 'queued') {
    job.status =
      crawl.status === 'queued'
        ? SearchJobStatus.QUEUED
        : SearchJobStatus.RUNNING;
  } else if (isTerminalHistoryStatus(crawl.status)) {
    // 개별 크롤 종료 — Job 은 아직 RUNNING (다른 키워드 대기 가능)
    job.status = SearchJobStatus.RUNNING;
    job.currentSite =
      crawl.status === 'failed' ? crawl.currentSite : null;
  }
}
