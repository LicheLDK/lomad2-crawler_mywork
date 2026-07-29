import { SearchJobStatus } from '@/database/entities/search-job.entity';
import { CrawlProgressEvent } from '@/progress/crawl-progress.types';
import {
  aggregateJobProgress,
  applyCrawlProgressToJob,
  clampProgress,
  isTerminalHistoryStatus,
  resolveJobStatusFromHistories,
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

describe('resolveJobStatusFromHistories (A4)', () => {
  it('all success → completed', () => {
    expect(
      resolveJobStatusFromHistories(['completed', 'cached', 'partial']),
    ).toBe(SearchJobStatus.COMPLETED);
  });

  it('some success + some failure/timeout → partial', () => {
    expect(
      resolveJobStatusFromHistories(['completed', 'failed', 'cached']),
    ).toBe(SearchJobStatus.PARTIAL);
    expect(
      resolveJobStatusFromHistories(['cached', 'timeout']),
    ).toBe(SearchJobStatus.PARTIAL);
  });

  it('all failure → failed', () => {
    expect(resolveJobStatusFromHistories(['failed', 'timeout'])).toBe(
      SearchJobStatus.FAILED,
    );
  });

  it('empty → failed', () => {
    expect(resolveJobStatusFromHistories([])).toBe(SearchJobStatus.FAILED);
  });
});

describe('aggregateJobProgress', () => {
  it('averages terminal and in-progress keywords', () => {
    expect(
      aggregateJobProgress([
        { status: 'completed' },
        { status: 'running', percent: 40 },
        { status: 'queued' },
      ]),
    ).toBe(50); // (100 + 40 + 10) / 3
  });

  it('all terminal → 100', () => {
    expect(
      aggregateJobProgress([
        { status: 'completed' },
        { status: 'failed' },
        { status: 'timeout' },
      ]),
    ).toBe(100);
  });
});

describe('isTerminalHistoryStatus', () => {
  it.each(['completed', 'partial', 'failed', 'cached', 'timeout'])(
    '%s is terminal',
    (status) => {
      expect(isTerminalHistoryStatus(status)).toBe(true);
    },
  );

  it.each(['queued', 'running', 'pending'])(
    '%s is not terminal',
    (status) => {
      expect(isTerminalHistoryStatus(status)).toBe(false);
    },
  );
});

describe('applyCrawlProgressToJob', () => {
  it('queued → running without finalizing the job', () => {
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

    // 개별 크롤 completed 여도 Job 은 RUNNING (다른 키워드 대기)
    applyCrawlProgressToJob(
      job,
      crawl({ status: 'completed', percent: 100, resultCount: 12 }),
    );
    expect(job.status).toBe(SearchJobStatus.RUNNING);
    expect(job.finishedAt).toBeNull();
  });

  it('does not reopen completed/failed/partial jobs', () => {
    const completed = baseJob({
      status: SearchJobStatus.COMPLETED,
      progress: 100,
    });
    applyCrawlProgressToJob(
      completed,
      crawl({ status: 'running', percent: 10, currentSite: 'karrot' }),
    );
    expect(completed.status).toBe(SearchJobStatus.COMPLETED);

    const failed = baseJob({ status: SearchJobStatus.FAILED });
    applyCrawlProgressToJob(failed, crawl({ status: 'queued', percent: 0 }));
    expect(failed.status).toBe(SearchJobStatus.FAILED);

    const partial = baseJob({ status: SearchJobStatus.PARTIAL });
    applyCrawlProgressToJob(
      partial,
      crawl({ status: 'running', percent: 20 }),
    );
    expect(partial.status).toBe(SearchJobStatus.PARTIAL);
  });
});
