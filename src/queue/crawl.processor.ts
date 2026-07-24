import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '@/common/constants/queue';
import {
  CrawlJobPayload,
  CrawlerService,
} from '@/crawler/crawler.service';

@Processor(QUEUE_NAMES.CRAWL, {
  concurrency: parseInt(process.env.CRAWL_CONCURRENCY || '5', 10),
})
export class CrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlProcessor.name);

  constructor(private readonly crawlerService: CrawlerService) {
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
}
