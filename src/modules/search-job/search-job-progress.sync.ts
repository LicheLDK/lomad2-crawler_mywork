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
  SearchJobStatus,
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
  aggregateJobProgress,
  clampProgress,
  isTerminalHistoryStatus,
} from './search-job-status.util';

/**
 * 크롤 progress(searchId) → Search Job progress(jobId) 동기화.
 * Redis pub/sub + DB 컬럼 갱신 + job progress 채널 발행.
 * Job 완료 판정은 SearchJobService.finalizeJob 이 담당한다.
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

      await this.updateJobHistoryFromCrawl(crawl);
      await this.refreshJobProgressFromHistories(crawl);
    } catch (error) {
      this.logger.warn(
        `Job progress sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * crawl progress 로 search_job_histories 행을 갱신한다.
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

  /**
   * 키워드 N개 진행률을 합산해 Job progress 를 갱신한다.
   * 완료/실패 판정은 하지 않는다.
   */
  private async refreshJobProgressFromHistories(
    crawl: CrawlProgressEvent,
  ): Promise<void> {
    const linked = await this.jobHistoryRepo.find({
      where: { searchHistoryId: crawl.searchId },
    });

    const jobIds = new Set(linked.map((r) => r.searchJobId));

    // 레거시: history 행이 없고 대표 searchHistoryId 만 있는 Job
    if (jobIds.size === 0) {
      const legacy = await this.jobRepo.findOne({
        where: { searchHistoryId: crawl.searchId },
      });
      if (legacy) jobIds.add(legacy.id);
    }

    for (const jobId of jobIds) {
      const job = await this.jobRepo.findOne({ where: { id: jobId } });
      if (!job) continue;
      if (
        job.status === SearchJobStatus.COMPLETED ||
        job.status === SearchJobStatus.PARTIAL ||
        job.status === SearchJobStatus.FAILED
      ) {
        continue;
      }

      const histories = await this.jobHistoryRepo.find({
        where: { searchJobId: jobId },
      });

      if (histories.length > 0) {
        job.progress = aggregateJobProgress(
          histories.map((h) => ({
            status: h.status,
            percent:
              h.searchHistoryId === crawl.searchId
                ? crawl.percent
                : isTerminalHistoryStatus(h.status)
                  ? 100
                  : undefined,
          })),
        );
        job.currentSite = crawl.currentSite;
        if (
          job.status !== SearchJobStatus.RUNNING &&
          job.status !== SearchJobStatus.QUEUED
        ) {
          job.status = SearchJobStatus.RUNNING;
        } else if (crawl.status === 'queued') {
          // keep queued only if all still queued — otherwise running
          const anyRunning = histories.some(
            (h) => h.status === 'running' || isTerminalHistoryStatus(h.status),
          );
          job.status = anyRunning
            ? SearchJobStatus.RUNNING
            : SearchJobStatus.QUEUED;
        } else {
          job.status = SearchJobStatus.RUNNING;
        }
      } else {
        // 레거시 단일 히스토리 Job
        job.progress = clampProgress(crawl.percent);
        job.currentSite = crawl.currentSite;
        if (!isTerminalHistoryStatus(crawl.status)) {
          job.status =
            crawl.status === 'queued'
              ? SearchJobStatus.QUEUED
              : SearchJobStatus.RUNNING;
        }
        job.resultCount = crawl.resultCount ?? job.resultCount;
      }

      await this.jobRepo.save(job);
      await this.publishFromJob(job, crawl.message);
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
