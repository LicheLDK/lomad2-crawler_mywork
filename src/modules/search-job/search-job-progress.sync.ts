import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import {
  SearchJob,
} from '@/database/entities/search-job.entity';
import { SearchJobHistory } from '@/database/entities/search-job-history.entity';
import {
  CRAWL_PROGRESS_CHANNEL,
  CrawlProgressEvent,
} from '@/progress/crawl-progress.types';
import {
  SEARCH_JOB_PROGRESS_CHANNEL,
  SearchJobProgressEvent,
} from './search-job-progress.types';
import {
  applyCrawlProgressToJob,
  clampProgress,
} from './search-job-status.util';

/**
 * 크롤 progress(searchId) → Search Job progress(jobId) 동기화.
 * Redis pub/sub + DB 컬럼 갱신 + job progress 채널 발행.
 */
@Injectable()
export class SearchJobProgressSync
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SearchJobProgressSync.name);
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  constructor(
    @InjectRepository(SearchJob)
    private readonly jobRepo: Repository<SearchJob>,
    @InjectRepository(SearchJobHistory)
    private readonly jobHistoryRepo: Repository<SearchJobHistory>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const opts = {
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      password: this.config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: null as null,
    };
    this.subscriber = new Redis(opts);
    this.publisher = new Redis({ ...opts, lazyConnect: true });

    await this.subscriber.subscribe(CRAWL_PROGRESS_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== CRAWL_PROGRESS_CHANNEL) return;
      void this.onCrawlProgress(message);
    });
    this.logger.log('SearchJobProgressSync subscribed to crawl progress');
  }

  async onModuleDestroy() {
    for (const client of [this.subscriber, this.publisher]) {
      if (!client) continue;
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }
  }

  /** Job 상태 변경 시 Progress API/WS용 이벤트 발행 */
  async publishFromJob(
    job: SearchJob,
    message?: string,
  ): Promise<SearchJobProgressEvent> {
    const event: SearchJobProgressEvent = {
      jobId: job.id,
      searchHistoryId: job.searchHistoryId,
      status: job.status,
      currentSite: job.currentSite,
      progress: clampProgress(job.progress),
      resultCount: job.resultCount ?? 0,
      message,
      at: new Date().toISOString(),
    };
    await this.publish(event);
    return event;
  }

  async getProgress(jobId: string): Promise<SearchJobProgressEvent | null> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return null;
    return {
      jobId: job.id,
      searchHistoryId: job.searchHistoryId,
      status: job.status,
      currentSite: job.currentSite,
      progress: clampProgress(job.progress),
      resultCount: job.resultCount ?? 0,
      at: new Date().toISOString(),
    };
  }

  private async onCrawlProgress(message: string) {
    try {
      const crawl = JSON.parse(message) as CrawlProgressEvent;
      if (!crawl?.searchId) return;

      // TASK A-3: 키워드별 history 행 상태/결과수 갱신 (Job 판정은 변경하지 않음)
      await this.updateJobHistoryFromCrawl(crawl);

      const job = await this.jobRepo.findOne({
        where: { searchHistoryId: crawl.searchId },
      });
      if (!job) return;

      applyCrawlProgressToJob(job, crawl);

      await this.jobRepo.save(job);
      await this.publishFromJob(job, crawl.message);
    } catch (error) {
      this.logger.warn(
        `Job progress sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * TASK A-3 이중 쓰기: crawl progress 로 search_job_histories 행을 갱신한다.
   * 실패해도 Job 동기화는 계속한다.
   */
  private async updateJobHistoryFromCrawl(
    crawl: CrawlProgressEvent,
  ): Promise<void> {
    try {
      const rows = await this.jobHistoryRepo.find({
        where: { searchHistoryId: crawl.searchId },
      });
      if (rows.length === 0) return;

      for (const row of rows) {
        row.status = crawl.status;
        if (crawl.resultCount != null) {
          row.resultCount = crawl.resultCount;
        }
      }
      await this.jobHistoryRepo.save(rows);
    } catch (error) {
      this.logger.warn(
        `SearchJobHistory progress dual-write failed searchId=${crawl.searchId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async publish(event: SearchJobProgressEvent) {
    try {
      if (!this.publisher) return;
      if (this.publisher.status !== 'ready') {
        await this.publisher.connect();
      }
      await this.publisher.publish(
        SEARCH_JOB_PROGRESS_CHANNEL,
        JSON.stringify(event),
      );
      await this.publisher.setex(
        `crawler:job-progress:last:${event.jobId}`,
        3600,
        JSON.stringify(event),
      );
    } catch (error) {
      this.logger.warn(
        `Job progress publish failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
