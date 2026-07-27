import { SearchJobStatus } from '@/database/entities/search-job.entity';
import { CrawlProgressEvent } from '@/progress/crawl-progress.types';
import {
  applyCrawlProgressToJob,
  clampProgress,
  SearchJobProgressFields,
} from './search-job-status.util';

function baseJob(
  overrides: Partial<SearchJobProgressFields> = {},
): SearchJobProgressFields {
  return {
    status: SearchJobStatus.PENDING,
    progress: 0,
    currentSite: null,
    resultCount: 0,
    finishedAt: null,
    errorMessage: null,
    ...overrides,
  };
}

function crawl(
  overrides: Partial<CrawlProgressEvent> &
    Pick<CrawlProgressEvent, 'status' | 'percent'>,
): CrawlProgressEvent {
  return {
    searchId: 'search-1',
    keyword: 'sofa',
    status: overrides.status,
    percent: overrides.percent,
    currentSite: overrides.currentSite ?? null,
    completedSites: overrides.completedSites ?? [],
    pendingSites: overrides.pendingSites ?? [],
    resultCount: overrides.resultCount ?? 0,
    totalSites: overrides.totalSites ?? 3,
    message: overrides.message,
    at: overrides.at ?? new Date().toISOString(),
  };
}

describe('clampProgress', () => {
  it.each([
    [null, 0],
    [undefined, 0],
    [-10, 0],
    [150, 100],
    [33.6, 34],
  ])('maps %p → %p', (input, expected) => {
    expect(clampProgress(input as number | null | undefined)).toBe(expected);
  });
});

describe('applyCrawlProgressToJob', () => {
  it('queued → running → completed', () => {
    const job = baseJob({ status: SearchJobStatus.PENDING });

    applyCrawlProgressToJob(
      job,
      crawl({ status: 'queued', percent: 2, currentSite: null }),
    );
    expect(job.status).toBe(SearchJobStatus.QUEUED);

    applyCrawlProgressToJob(
      job,
      crawl({
        status: 'running',
        percent: 40,
        currentSite: 'bungae',
        resultCount: 5,
      }),
    );
    expect(job.status).toBe(SearchJobStatus.RUNNING);
    expect(job.currentSite).toBe('bungae');
    expect(job.resultCount).toBe(5);

    applyCrawlProgressToJob(
      job,
      crawl({ status: 'completed', percent: 100, resultCount: 12 }),
    );
    expect(job.status).toBe(SearchJobStatus.COMPLETED);
    expect(job.progress).toBe(100);
    expect(job.currentSite).toBeNull();
    expect(job.finishedAt).toBeInstanceOf(Date);
  });

  it('partial also completes the job', () => {
    const job = baseJob({ status: SearchJobStatus.RUNNING });
    applyCrawlProgressToJob(job, crawl({ status: 'partial', percent: 80 }));
    expect(job.status).toBe(SearchJobStatus.COMPLETED);
    expect(job.progress).toBe(100);
  });

  it('failed sets error and finishedAt', () => {
    const job = baseJob({ status: SearchJobStatus.RUNNING });
    applyCrawlProgressToJob(
      job,
      crawl({ status: 'failed', percent: 50, message: 'timeout' }),
    );
    expect(job.status).toBe(SearchJobStatus.FAILED);
    expect(job.errorMessage).toBe('timeout');
    expect(job.finishedAt).toBeInstanceOf(Date);
  });

  it('does not reopen completed/failed jobs on late running events', () => {
    const completed = baseJob({ status: SearchJobStatus.COMPLETED, progress: 100 });
    applyCrawlProgressToJob(
      completed,
      crawl({ status: 'running', percent: 10, currentSite: 'karrot' }),
    );
    expect(completed.status).toBe(SearchJobStatus.COMPLETED);

    const failed = baseJob({ status: SearchJobStatus.FAILED });
    applyCrawlProgressToJob(
      failed,
      crawl({ status: 'queued', percent: 0 }),
    );
    expect(failed.status).toBe(SearchJobStatus.FAILED);
  });
});
