import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { JOB_NAMES, QUEUE_NAMES } from '@/common/constants/queue';
import { CrawlJobPayload } from '@/crawler/crawler.service';

@Injectable()
export class CrawlQueueService {
  private readonly logger = new Logger(CrawlQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.CRAWL) private readonly crawlQueue: Queue,
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
      removeOnFail: 200,
    });

    this.logger.log(`Enqueued crawl job ${job.id}`);
    return String(job.id);
  }

  async getJobCounts() {
    return this.crawlQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );
  }
}
