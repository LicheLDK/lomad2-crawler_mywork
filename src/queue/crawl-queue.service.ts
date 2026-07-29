import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { JOB_NAMES, QUEUE_NAMES } from '@/common/constants/queue';
import { CrawlJobPayload } from '@/crawler/crawler.service';

export interface DlqJobPayload {
  originalJobId: string;
  originalJobName: string;
  crawlPayload: CrawlJobPayload;
  failedReason: string;
  failedAt: string;
  attemptsMade: number;
}

export interface FailedJobSummary {
  id: string;
  originalJobId: string;
  jobName: string;
  searchHistoryId: string;
  keyword: string;
  failedReason: string;
  failedAt: string;
  attemptsMade: number;
}

@Injectable()
export class CrawlQueueService {
  private readonly logger = new Logger(CrawlQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.CRAWL) private readonly crawlQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CRAWL_DLQ) private readonly dlqQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async enqueueSearchCrawl(
    payload: CrawlJobPayload,
    options?: { priority?: number; delay?: number },
  ): Promise<string> {
    const job = await this.crawlQueue.add(JOB_NAMES.SEARCH_CRAWL, payload, {
      jobId: `search-${payload.searchHistoryId}`,
      priority: options?.priority ?? 5,
      delay: options?.delay ?? 0,
      attempts: this.config.get<number>('redis.attempts') ?? 3,
      backoff: {
        type: 'exponential',
        delay: this.config.get<number>('redis.backoffMs') ?? 5000,
      },
      removeOnComplete: 100,
      removeOnFail: true,
    });

    this.logger.log(`Enqueued crawl job ${job.id}`);
    return String(job.id);
  }

  async moveExhaustedJobToDlq(
    job: Job<CrawlJobPayload>,
    error: Error,
  ): Promise<void> {
    const dlqJobId = this.toDlqJobId(String(job.id));
    const existing = await this.dlqQueue.getJob(dlqJobId);
    if (existing) {
      this.logger.warn(`DLQ job already exists for ${job.id}, skipping duplicate`);
      await job.remove().catch(() => undefined);
      return;
    }

    const payload: DlqJobPayload = {
      originalJobId: String(job.id),
      originalJobName: job.name,
      crawlPayload: job.data,
      failedReason: error.message?.slice(0, 2000) || 'Unknown error',
      failedAt: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
    };

    await this.dlqQueue.add(JOB_NAMES.SEARCH_CRAWL, payload, {
      jobId: dlqJobId,
      removeOnComplete: true,
      removeOnFail: this.getDlqRetentionOptions(),
    });

    await job.remove().catch((removeError) => {
      this.logger.warn(
        `Failed to remove exhausted job ${job.id} from main queue: ${removeError}`,
      );
    });

    this.logger.warn(
      `Moved exhausted job ${job.id} to DLQ (attempts=${job.attemptsMade})`,
    );
  }

  async listFailedJobs(limit = 50): Promise<{
    total: number;
    items: FailedJobSummary[];
  }> {
    const max = Math.min(Math.max(limit, 1), 100);
    const jobs = await this.dlqQueue.getJobs(['waiting'], 0, max - 1, true);
    const items = jobs
      .map((job) => this.toFailedJobSummary(job))
      .filter((item): item is FailedJobSummary => item != null)
      .sort(
        (a, b) =>
          new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime(),
      );

    const counts = await this.dlqQueue.getJobCounts('waiting');
    return {
      total: counts.waiting ?? items.length,
      items,
    };
  }

  async retryFailedJob(dlqJobId: string): Promise<{ jobId: string }> {
    const job = await this.dlqQueue.getJob(dlqJobId);
    if (!job) {
      throw new NotFoundException(`DLQ job not found: ${dlqJobId}`);
    }

    const data = job.data as DlqJobPayload;
    if (!data?.crawlPayload?.searchHistoryId) {
      throw new NotFoundException(`Invalid DLQ payload for job: ${dlqJobId}`);
    }

    const newJobId = await this.enqueueSearchCrawl(data.crawlPayload);
    await job.remove();

    this.logger.log(
      `Retried DLQ job ${dlqJobId} as new crawl job ${newJobId}`,
    );
    return { jobId: newJobId };
  }

  async getJobCounts() {
    const [main, dlqWaiting] = await Promise.all([
      this.crawlQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
      this.dlqQueue.getJobCounts('waiting'),
    ]);

    const dlq = dlqWaiting.waiting ?? 0;
    return {
      ...main,
      dlq,
      failed: (main.failed ?? 0) + dlq,
    };
  }

  private toDlqJobId(originalJobId: string): string {
    return `dlq-${originalJobId}`;
  }

  private getDlqRetentionOptions() {
    const days = this.config.get<number>('redis.failedRetentionDays') ?? 14;
    const count = this.config.get<number>('redis.failedMaxCount') ?? 500;
    const ageSeconds = Math.max(days, 1) * 24 * 60 * 60;
    return {
      count: Math.max(count, 1),
      age: ageSeconds,
    };
  }

  private toFailedJobSummary(job: Job): FailedJobSummary | null {
    const data = job.data as DlqJobPayload;
    if (!data?.crawlPayload?.searchHistoryId) return null;
    return {
      id: String(job.id),
      originalJobId: data.originalJobId,
      jobName: data.originalJobName,
      searchHistoryId: data.crawlPayload.searchHistoryId,
      keyword: data.crawlPayload.keyword,
      failedReason: data.failedReason,
      failedAt: data.failedAt,
      attemptsMade: data.attemptsMade,
    };
  }
}
