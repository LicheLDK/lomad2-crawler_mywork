import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageLog, CrawlSiteAttempt } from '@/database/entities';

export interface RetentionCleanupResult {
  enabled: boolean;
  ranAt: string;
  crawlSiteAttemptsDeleted: number;
  aiUsageLogsDeleted: number;
  crawlAttemptsRetentionDays: number;
  aiUsageRetentionDays: number;
}

@Injectable()
export class RetentionCleanupService {
  private readonly logger = new Logger(RetentionCleanupService.name);
  private lastRunAt: Date | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(CrawlSiteAttempt)
    private readonly attemptRepo: Repository<CrawlSiteAttempt>,
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
  ) {}

  getLastRunAt(): Date | null {
    return this.lastRunAt;
  }

  async runCleanup(): Promise<RetentionCleanupResult> {
    const enabled = this.config.get<boolean>('retention.enabled') ?? true;
    const crawlAttemptsDays =
      this.config.get<number>('retention.crawlAttemptsDays') ?? 90;
    const aiUsageDays = this.config.get<number>('retention.aiUsageDays') ?? 180;
    const batchSize = this.config.get<number>('retention.batchSize') ?? 1000;
    const ranAt = new Date();

    if (!enabled) {
      this.logger.log('Metrics retention cleanup is disabled (METRICS_RETENTION_ENABLED=false)');
      return {
        enabled: false,
        ranAt: ranAt.toISOString(),
        crawlSiteAttemptsDeleted: 0,
        aiUsageLogsDeleted: 0,
        crawlAttemptsRetentionDays: crawlAttemptsDays,
        aiUsageRetentionDays: aiUsageDays,
      };
    }

    const attemptsCutoff = this.daysAgo(crawlAttemptsDays, ranAt);
    const usageCutoff = this.daysAgo(aiUsageDays, ranAt);

    const crawlSiteAttemptsDeleted = await this.purgeCrawlSiteAttempts(
      attemptsCutoff,
      batchSize,
    );
    const aiUsageLogsDeleted = await this.purgeAiUsageLogs(
      usageCutoff,
      batchSize,
    );

    this.lastRunAt = ranAt;

    this.logger.log(
      `Retention cleanup complete: crawl_site_attempts=${crawlSiteAttemptsDeleted}, ai_usage_logs=${aiUsageLogsDeleted}`,
    );

    return {
      enabled: true,
      ranAt: ranAt.toISOString(),
      crawlSiteAttemptsDeleted,
      aiUsageLogsDeleted,
      crawlAttemptsRetentionDays: crawlAttemptsDays,
      aiUsageRetentionDays: aiUsageDays,
    };
  }

  async purgeCrawlSiteAttempts(
    cutoff: Date,
    batchSize = this.config.get<number>('retention.batchSize') ?? 1000,
  ): Promise<number> {
    return this.deleteOlderThanBatch(
      this.attemptRepo,
      'crawl_site_attempts',
      'createdAt',
      cutoff,
      batchSize,
    );
  }

  async purgeAiUsageLogs(
    cutoff: Date,
    batchSize = this.config.get<number>('retention.batchSize') ?? 1000,
  ): Promise<number> {
    return this.deleteOlderThanBatch(
      this.usageRepo,
      'ai_usage_logs',
      'created_at',
      cutoff,
      batchSize,
    );
  }

  private daysAgo(days: number, from: Date): Date {
    const cutoff = new Date(from);
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    return cutoff;
  }

  private async deleteOlderThanBatch(
    repo: Repository<CrawlSiteAttempt | AiUsageLog>,
    tableName: string,
    dateColumn: string,
    cutoff: Date,
    batchSize: number,
  ): Promise<number> {
    let totalDeleted = 0;

    while (true) {
      const result = await repo
        .createQueryBuilder()
        .delete()
        .where(
          `"id" IN (
            SELECT "id" FROM "${tableName}"
            WHERE "${dateColumn}" < :cutoff
            LIMIT :batchSize
          )`,
          { cutoff, batchSize },
        )
        .execute();

      const deleted = result.affected ?? 0;
      totalDeleted += deleted;

      if (deleted < batchSize) {
        break;
      }
    }

    return totalDeleted;
  }
}
