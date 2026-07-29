import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '@/common/constants/queue';
import {
  CrawlJobPayload,
  CrawlerService,
} from '@/crawler/crawler.service';
import { CrawlQueueService } from './crawl-queue.service';

@Processor(QUEUE_NAMES.CRAWL, {
  concurrency: parseInt(process.env.CRAWL_CONCURRENCY || '5', 10),
})
export class CrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlProcessor.name);

  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly crawlQueueService: CrawlQueueService,
  ) {
    super();
  }

  async process(job: Job<CrawlJobPayload>): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} name=${job.name}`);

    if (job.name !== JOB_NAMES.SEARCH_CRAWL) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return { skipped: true };
    }

    const result = await this.crawlerService.executeCrawl(job.data);
    this.logger.log(
      `Job ${job.id} done saved=${result.saved} errors=${result.errors.length}`,
    );
    return result;
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<CrawlJobPayload> | undefined, error: Error) {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    try {
      await this.crawlQueueService.moveExhaustedJobToDlq(job, error);
    } catch (dlqError) {
      this.logger.error(
        `Failed to move job ${job.id} to DLQ: ${dlqError}`,
      );
    }
  }
}
