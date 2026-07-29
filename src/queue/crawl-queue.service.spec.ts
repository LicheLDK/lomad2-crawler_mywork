import { NotFoundException } from '@nestjs/common';
import { CrawlQueueService } from './crawl-queue.service';
import { JOB_NAMES } from '@/common/constants/queue';

describe('CrawlQueueService', () => {
  function createService() {
    const crawlQueue = {
      add: jest.fn().mockResolvedValue({ id: 'search-abc' }),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 1,
        active: 0,
        completed: 10,
        failed: 0,
        delayed: 0,
      }),
    };
    const dlqQueue = {
      getJob: jest.fn(),
      add: jest.fn().mockResolvedValue({ id: 'dlq-search-abc' }),
      getJobs: jest.fn().mockResolvedValue([]),
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0 }),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'redis.attempts') return 3;
        if (key === 'redis.backoffMs') return 5000;
        if (key === 'redis.failedRetentionDays') return 14;
        if (key === 'redis.failedMaxCount') return 500;
        return undefined;
      }),
    };

    const service = new CrawlQueueService(
      crawlQueue as never,
      dlqQueue as never,
      config as never,
    );

    return { service, crawlQueue, dlqQueue, config };
  }

  it('moveExhaustedJobToDlq adds payload to DLQ and removes main job', async () => {
    const { service, dlqQueue } = createService();
    dlqQueue.getJob.mockResolvedValue(null);

    const remove = jest.fn().mockResolvedValue(undefined);
    const job = {
      id: 'search-abc',
      name: JOB_NAMES.SEARCH_CRAWL,
      data: {
        searchHistoryId: 'hist-1',
        keyword: '침대',
      },
      attemptsMade: 3,
      opts: { attempts: 3 },
      remove,
    };

    await service.moveExhaustedJobToDlq(job as never, new Error('timeout'));

    expect(dlqQueue.add).toHaveBeenCalledWith(
      JOB_NAMES.SEARCH_CRAWL,
      expect.objectContaining({
        originalJobId: 'search-abc',
        crawlPayload: job.data,
        failedReason: 'timeout',
        attemptsMade: 3,
      }),
      expect.objectContaining({ jobId: 'dlq-search-abc' }),
    );
    expect(remove).toHaveBeenCalled();
  });

  it('retryFailedJob re-enqueues crawl payload and removes DLQ job', async () => {
    const { service, crawlQueue, dlqQueue } = createService();
    const remove = jest.fn().mockResolvedValue(undefined);
    dlqQueue.getJob.mockResolvedValue({
      id: 'dlq-search-abc',
      data: {
        originalJobId: 'search-abc',
        originalJobName: JOB_NAMES.SEARCH_CRAWL,
        crawlPayload: {
          searchHistoryId: 'hist-1',
          keyword: '침대',
        },
        failedReason: 'timeout',
        failedAt: '2026-07-29T00:00:00.000Z',
        attemptsMade: 3,
      },
      remove,
    });

    const result = await service.retryFailedJob('dlq-search-abc');

    expect(crawlQueue.add).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(result).toEqual({ jobId: 'search-abc' });
  });

  it('retryFailedJob throws NotFound when DLQ job missing', async () => {
    const { service, dlqQueue } = createService();
    dlqQueue.getJob.mockResolvedValue(null);

    await expect(service.retryFailedJob('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getJobCounts merges DLQ waiting into failed', async () => {
    const { service, dlqQueue } = createService();
    dlqQueue.getJobCounts.mockResolvedValue({ waiting: 2 });

    const counts = await service.getJobCounts();

    expect(counts.dlq).toBe(2);
    expect(counts.failed).toBe(2);
  });
});
