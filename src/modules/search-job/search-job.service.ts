import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SearchJob,
  SearchJobStatus,
} from '@/database/entities/search-job.entity';
import { SearchJobHistory } from '@/database/entities/search-job-history.entity';
import { SearchHistoryResult } from '@/database/entities/search-history-result.entity';
import { SearchService } from '@/modules/search/search.service';
import { CreateSearchJobDto } from './dto/create-search-job.dto';
import { SearchJobProgressSync } from './search-job-progress.sync';
import { SearchKeywordGeneratorService } from './search-keyword-generator.service';
import { InvestigationService } from '@/modules/investigation/investigation.service';
import { RentalService } from '@/api/rental.service';
import { AiService } from '@/ai/ai.service';
import {
  aggregateJobProgress,
  isSuccessfulHistoryStatus,
  isTerminalHistoryStatus,
  resolveJobStatusFromHistories,
} from './search-job-status.util';

const POLL_INTERVAL_MS = 2000;

@Injectable()
export class SearchJobService {
  private readonly logger = new Logger(SearchJobService.name);

  constructor(
    @InjectRepository(SearchJob)
    private readonly jobRepo: Repository<SearchJob>,
    @InjectRepository(SearchJobHistory)
    private readonly jobHistoryRepo: Repository<SearchJobHistory>,
    @InjectRepository(SearchHistoryResult)
    private readonly historyResultRepo: Repository<SearchHistoryResult>,
    private readonly searchService: SearchService,
    private readonly progressSync: SearchJobProgressSync,
    private readonly keywordGenerator: SearchKeywordGeneratorService,
    private readonly investigationService: InvestigationService,
    private readonly rentalService: RentalService,
    private readonly aiService: AiService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Job 생성 후 즉시 jobId 반환.
   * 주문정보는 Rental API Client 로만 조회한다 (BackOffice Master).
   */
  async create(dto: CreateSearchJobDto) {
    const orderNo = dto.orderNo.trim();
    let searchInput;
    try {
      searchInput = await this.rentalService.resolveSearchInput(orderNo);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new BadRequestException(
        `주문정보를 조회할 수 없습니다 (orderNo=${orderNo}): ${message}`,
      );
    }

    const keywords = await this.keywordGenerator.generateAsync({
      brand: searchInput.brand,
      productName: searchInput.productName,
      modelName: searchInput.modelName,
      option: searchInput.option,
      color: searchInput.color,
    });

    if (keywords.length === 0) {
      throw new BadRequestException(
        '검색어를 생성할 수 없습니다. BackOffice 주문 상품명/모델을 확인하세요.',
      );
    }

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        orderNo,
        // 고객 개인정보는 영속화하지 않는다.
        contractNo: null,
        customerName: null,
        // 검색 실행 스냅샷
        brand: searchInput.brand ?? null,
        modelName: searchInput.modelName ?? null,
        option: searchInput.option ?? null,
        color: searchInput.color ?? null,
        productNo: searchInput.externalProductId || null,
        productName: searchInput.productName,
        keywords,
        referenceImageUrl: searchInput.referenceImageUrl ?? null,
        sites: dto.sites?.length ? dto.sites : null,
        useCache: dto.useCache !== false,
        status: SearchJobStatus.PENDING,
        progress: 0,
        currentSite: null,
        resultCount: 0,
      }),
    );

    this.logger.log(
      `SearchJob created id=${job.id} orderNo=${job.orderNo} keywords=${keywords.length} (via Rental API)`,
    );

    await this.progressSync.publishFromJob(job, 'Search job created');

    void this.runSearch(job.id);

    return this.toCreateResponse(job);
  }

  async getOne(jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Search job not found: ${jobId}`);
    }
    return this.toDetailResponse(job);
  }

  async getProgress(jobId: string) {
    const event = await this.progressSync.getProgress(jobId);
    if (!event) {
      throw new NotFoundException(`Search job not found: ${jobId}`);
    }
    const keywordHistories = await this.listKeywordHistories(jobId);
    return {
      jobId: event.jobId,
      status: event.status,
      currentSite: event.currentSite,
      progress: event.progress,
      // A1: 고유 매물 수 (키워드별 합계와 다를 수 있음)
      resultCount: event.resultCount,
      searchHistoryId: event.searchHistoryId,
      message: event.message,
      at: event.at,
      keywordHistories,
    };
  }

  /**
   * Rental Page: 최근 Search Job 목록 (Job Status 중심)
   * 주문 마스터는 포함하지 않는다 — orderNo 참조만.
   */
  async listRecentJobs(limit = 40) {
    const take = Math.min(Math.max(Number(limit) || 40, 1), 100);
    const jobs = await this.jobRepo.find({
      order: { requestedAt: 'DESC' },
      take,
    });

    const counts = await this.investigationService.countBySearchJobIds(
      jobs.map((j) => j.id),
    );

    const items = jobs.map((job) => ({
      jobId: job.id,
      orderNo: job.orderNo,
      status: job.status,
      progress: job.progress,
      currentSite: job.currentSite,
      resultCount: job.resultCount,
      searchHistoryId: job.searchHistoryId,
      keywords: job.keywords ?? [],
      requestedAt: job.requestedAt,
      finishedAt: job.finishedAt,
      investigationCount: counts.get(job.id) ?? 0,
    }));

    return { total: items.length, items };
  }

  /**
   * Rental Page: Job 선택 → 실시간 Status + Search History + Investigation
   * 주문 표시 정보는 Rental API 로 조회 (비영속).
   */
  async getRentalJobDetail(jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Search job not found: ${jobId}`);
    }

    const investigations =
      await this.investigationService.listBySearchJobId(jobId);

    let order: ReturnType<RentalService['toPublicOrder']> | null = null;
    let orderError: string | null = null;
    try {
      const rentalOrder = await this.rentalService.getOrder(job.orderNo);
      order = this.rentalService.toPublicOrder(rentalOrder);
    } catch (error) {
      orderError =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Rental order fetch failed jobId=${jobId} orderNo=${job.orderNo}: ${orderError}`,
      );
    }

    const searchHistories = job.searchHistoryId
      ? [
          {
            searchHistoryId: job.searchHistoryId,
            jobId: job.id,
            keywords: job.keywords ?? [],
            status: job.status,
            resultCount: job.resultCount,
            requestedAt: job.requestedAt,
            finishedAt: job.finishedAt,
          },
        ]
      : [];

    return {
      job: await this.toDetailResponse(job),
      order,
      orderError,
      searchHistories,
      investigations,
      investigationCount: investigations.length,
    };
  }

  private async runSearch(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;

    try {
      job.status = SearchJobStatus.QUEUED;
      job.progress = 5;
      await this.jobRepo.save(job);
      await this.progressSync.publishFromJob(job, 'Queued');

      const keywords =
        job.keywords?.length > 0
          ? job.keywords
          : this.keywordGenerator.generate({
              productName: job.productName,
            });

      if (keywords.length === 0) {
        throw new Error('No search keywords generated');
      }

      job.status = SearchJobStatus.RUNNING;
      job.progress = 10;
      await this.jobRepo.save(job);
      await this.progressSync.publishFromJob(job, 'Searching');

      // A2: 대표 히스토리 = 첫 크롤 히스토리. A4: 모든 비종료 히스토리를 감시.
      for (let i = 0; i < keywords.length; i++) {
        const keyword = keywords[i];
        const pct = 10 + Math.floor((i / keywords.length) * 50);
        job.progress = Math.min(60, pct);
        await this.jobRepo.save(job);
        await this.progressSync.publishFromJob(
          job,
          `Searching: ${keyword}`,
        );

        const result = await this.searchService.search({
          keyword,
          externalProductId: job.productNo ?? undefined,
          sites: job.sites ?? undefined,
          referenceImageUrl: job.referenceImageUrl ?? undefined,
          useCache: job.useCache,
        });

        await this.recordJobHistory(job.id, keyword, result);

        if (result?.searchId && !job.searchHistoryId) {
          // A2: 첫 히스토리를 대표로 유지
          job.searchHistoryId = result.searchId;
        }
      }

      const rows = await this.jobHistoryRepo.find({
        where: { searchJobId: job.id },
      });
      job.resultCount = await this.countDistinctResultIds(
        rows.map((r) => r.searchHistoryId),
      );

      const pending = rows.filter(
        (r) => !isTerminalHistoryStatus(r.status),
      );

      if (pending.length > 0) {
        job.status = SearchJobStatus.RUNNING;
        job.progress = Math.max(
          job.progress,
          aggregateJobProgress(
            rows.map((r) => ({
              status: r.status,
              percent: isTerminalHistoryStatus(r.status) ? 100 : 10,
            })),
          ),
        );
        await this.jobRepo.save(job);
        await this.progressSync.publishFromJob(job, 'Crawling');
        void this.watchJobHistories(job.id);
      } else {
        await this.jobRepo.save(job);
        await this.finalizeJob(job.id);
      }

      this.logger.log(
        `SearchJob ${job.id} keywords=${keywords.length} history=${job.searchHistoryId} status=${job.status} pending=${pending.length}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`SearchJob ${jobId} failed: ${message}`);
      await this.jobRepo.update(jobId, {
        status: SearchJobStatus.FAILED,
        errorMessage: message,
        finishedAt: new Date(),
      });
      const failed = await this.jobRepo.findOne({ where: { id: jobId } });
      if (failed) {
        await this.progressSync.publishFromJob(failed, message);
      }
    }
  }

  /**
   * search_job_histories 에 키워드별 행을 기록한다.
   * 기록 실패는 검색 실패로 전파하지 않는다.
   */
  private async recordJobHistory(
    searchJobId: string,
    keyword: string,
    result: {
      searchId?: string;
      status?: string;
      source?: string;
      resultCount?: number;
    },
  ): Promise<void> {
    try {
      if (!result?.searchId) return;

      const status = String(result.status ?? 'queued');
      const terminal =
        isTerminalHistoryStatus(status) || result.source === 'cache';
      const needsCrawl = !terminal && result.source !== 'cache';

      await this.jobHistoryRepo.save(
        this.jobHistoryRepo.create({
          searchJobId,
          keyword,
          searchHistoryId: result.searchId,
          status: needsCrawl ? 'queued' : status,
          resultCount: result.resultCount ?? 0,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `SearchJob ${searchJobId} history dual-write failed keyword=${keyword}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Job 의 모든 비종료 히스토리를 감시한다 (A3 이중 타임아웃).
   * - 키워드별: SEARCH_JOB_KEYWORD_TIMEOUT_MS
   * - Job 전체: SEARCH_JOB_TOTAL_TIMEOUT_MS
   */
  private async watchJobHistories(jobId: string): Promise<void> {
    const keywordTimeoutMs = this.getKeywordTimeoutMs();
    const totalTimeoutMs = this.getTotalTimeoutMs();
    const watchStartedAt = Date.now();

    while (true) {
      await this.sleep(POLL_INTERVAL_MS);

      try {
        const job = await this.jobRepo.findOne({ where: { id: jobId } });
        if (!job) return;
        if (
          job.status === SearchJobStatus.COMPLETED ||
          job.status === SearchJobStatus.PARTIAL ||
          job.status === SearchJobStatus.FAILED
        ) {
          return;
        }

        const rows = await this.jobHistoryRepo.find({
          where: { searchJobId: jobId },
        });
        if (rows.length === 0) {
          await this.finalizeJob(jobId);
          return;
        }

        const totalElapsed = Date.now() - watchStartedAt;
        if (totalElapsed >= totalTimeoutMs) {
          await this.markIncompleteRowsTimeout(rows);
          await this.finalizeJob(jobId);
          return;
        }

        let currentSite: string | null = null;
        const percents = new Map<string, number>();

        for (const row of rows) {
          if (isTerminalHistoryStatus(row.status)) {
            percents.set(row.id, 100);
            continue;
          }

          const ageMs = Date.now() - new Date(row.createdAt).getTime();
          if (ageMs >= keywordTimeoutMs) {
            row.status = 'timeout';
            await this.jobHistoryRepo.save(row);
            percents.set(row.id, 100);
            this.logger.warn(
              `SearchJob ${jobId} keyword timed out history=${row.searchHistoryId} keyword=${row.keyword}`,
            );
            continue;
          }

          try {
            const detail = await this.searchService.getSearch(
              row.searchHistoryId,
            );
            row.status = String(detail.status ?? row.status);
            row.resultCount = Math.max(
              row.resultCount ?? 0,
              detail.resultCount ?? 0,
            );
            await this.jobHistoryRepo.save(row);

            if (!isTerminalHistoryStatus(row.status)) {
              percents.set(row.id, 40);
              currentSite = currentSite ?? null;
            } else {
              percents.set(row.id, 100);
            }
          } catch (error) {
            this.logger.warn(
              `SearchJob ${jobId} watch poll error history=${row.searchHistoryId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            percents.set(row.id, 20);
          }
        }

        const refreshed = await this.jobHistoryRepo.find({
          where: { searchJobId: jobId },
        });
        const allTerminal = refreshed.every((r) =>
          isTerminalHistoryStatus(r.status),
        );

        job.resultCount = await this.countDistinctResultIds(
          refreshed.map((r) => r.searchHistoryId),
        );
        job.progress = aggregateJobProgress(
          refreshed.map((r) => ({
            status: r.status,
            percent: percents.get(r.id) ?? undefined,
          })),
        );
        job.currentSite = currentSite;
        await this.jobRepo.save(job);
        await this.progressSync.publishFromJob(
          job,
          allTerminal ? 'Finalizing' : 'Crawling',
        );

        if (allTerminal) {
          await this.finalizeJob(jobId);
          return;
        }
      } catch (error) {
        this.logger.warn(
          `SearchJob ${jobId} watch error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async markIncompleteRowsTimeout(
    rows: SearchJobHistory[],
  ): Promise<void> {
    const incomplete = rows.filter(
      (r) => !isTerminalHistoryStatus(r.status),
    );
    for (const row of incomplete) {
      row.status = 'timeout';
    }
    if (incomplete.length > 0) {
      await this.jobHistoryRepo.save(incomplete);
    }
  }

  /**
   * 모든 히스토리가 terminal 일 때 Job 상태·집계·조사를 확정한다.
   */
  private async finalizeJob(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;
    if (
      job.finishedAt &&
      (job.status === SearchJobStatus.COMPLETED ||
        job.status === SearchJobStatus.PARTIAL ||
        job.status === SearchJobStatus.FAILED)
    ) {
      return;
    }

    const rows = await this.jobHistoryRepo.find({
      where: { searchJobId: jobId },
    });

    // dual-write 실패 등으로 행이 없으면 대표 히스토리로 완료 처리 (검색 자체는 성공)
    if (rows.length === 0) {
      if (!job.searchHistoryId) {
        job.status = SearchJobStatus.FAILED;
        job.progress = job.progress || 0;
        job.finishedAt = new Date();
        job.errorMessage = 'No search histories recorded';
        await this.jobRepo.save(job);
        await this.progressSync.publishFromJob(job, 'Failed');
        return;
      }
      job.status = SearchJobStatus.COMPLETED;
      job.progress = 100;
      job.currentSite = null;
      job.finishedAt = new Date();
      job.errorMessage = null;
      job.resultCount = await this.countDistinctResultIds([
        job.searchHistoryId,
      ]);
      await this.jobRepo.save(job);
      await this.progressSync.publishFromJob(job, 'Completed');
      await this.triggerAutoInvestigation(jobId);
      return;
    }

    const statuses = rows.map((r) => r.status);
    const jobStatus = resolveJobStatusFromHistories(statuses);

    // A1: Job resultCount = 고유 resultId 수 (키워드별 합계와 다를 수 있음)
    job.resultCount = await this.countDistinctResultIds(
      rows.map((r) => r.searchHistoryId),
    );
    job.status = jobStatus;
    job.progress = 100;
    job.currentSite = null;
    job.finishedAt = new Date();
    job.errorMessage =
      jobStatus === SearchJobStatus.FAILED
        ? 'All keyword searches failed or timed out'
        : jobStatus === SearchJobStatus.PARTIAL
          ? 'Some keyword searches failed or timed out'
          : null;

    await this.jobRepo.save(job);
    await this.progressSync.publishFromJob(
      job,
      jobStatus === SearchJobStatus.FAILED
        ? 'Failed'
        : jobStatus === SearchJobStatus.PARTIAL
          ? 'Partial'
          : 'Completed',
    );

    this.logger.log(
      `SearchJob ${jobId} finalized status=${jobStatus} resultCount=${job.resultCount} histories=${rows.length}`,
    );

    if (
      jobStatus === SearchJobStatus.COMPLETED ||
      jobStatus === SearchJobStatus.PARTIAL
    ) {
      await this.triggerAutoInvestigation(jobId);
    }
  }

  /**
   * A1: Job에 속한 모든 히스토리의 고유 resultId 수.
   * 키워드별 resultCount 합계 ≠ Job resultCount 가 정상이다 (중복 매물).
   */
  private async countDistinctResultIds(
    searchHistoryIds: string[],
  ): Promise<number> {
    const ids = [...new Set(searchHistoryIds.filter(Boolean))];
    if (ids.length === 0) return 0;

    const raw = await this.historyResultRepo
      .createQueryBuilder('shr')
      .select('COUNT(DISTINCT shr.resultId)', 'cnt')
      .where('shr.searchHistoryId IN (:...ids)', { ids })
      .getRawOne<{ cnt: string }>();

    return parseInt(raw?.cnt ?? '0', 10) || 0;
  }

  /**
   * 조사 케이스 생성 — Job의 모든 성공 히스토리를 순회한다.
   * P0 upsert·exclude 정책은 InvestigationService.autoCreateFromSearch 에 위임.
   */
  private async triggerAutoInvestigation(
    searchJobId: string,
  ): Promise<void> {
    try {
      const job = await this.jobRepo.findOne({
        where: { id: searchJobId },
      });
      const rows = await this.jobHistoryRepo.find({
        where: { searchJobId },
      });
      const targets = rows.filter((r) =>
        isSuccessfulHistoryStatus(r.status),
      );

      // 히스토리 행이 없으면(레거시) 대표 searchHistoryId 로 1회 시도
      if (targets.length === 0 && job?.searchHistoryId) {
        await this.investigateOneHistory(
          searchJobId,
          job,
          job.searchHistoryId,
        );
      } else {
        for (const row of targets) {
          await this.investigateOneHistory(
            searchJobId,
            job,
            row.searchHistoryId,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `SearchJob ${searchJobId} investigation auto-create failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await this.sendBackOfficeCallback(searchJobId);
  }

  private async investigateOneHistory(
    searchJobId: string,
    job: SearchJob | null,
    searchHistoryId: string,
  ): Promise<void> {
    const detail = await this.searchService.getSearch(searchHistoryId);
    let results = Array.isArray(detail.results)
      ? (
          detail.results as Array<{
            id: string;
            title: string;
            siteCode: string;
            url: string;
            imageUrl?: string | null;
            price?: string | null;
            description?: string | null;
            titleSimilarity?: number | null;
            imageSimilarity?: number | null;
            matchingScore?: number | null;
            aiScore?: number | null;
            matchingReason?: string | null;
            matchingScores?: {
              brand?: number;
              model?: number;
              productName?: number;
              price?: number;
              option?: number;
              color?: number;
              image?: number;
              description?: number;
              ocr?: number;
            } | null;
          }>
        )
      : [];

    if (job && this.aiService.canMatch() && results.length > 0) {
      try {
        const matches = await this.aiService.matchSearchResults({
          rental: this.toMatchingRentalSnapshot(job),
          listings: results.map((r) => ({
            id: r.id,
            title: r.title,
            price: r.price,
            imageUrl: r.imageUrl,
            description: r.description,
            siteCode: r.siteCode,
            url: r.url,
            titleSimilarity: r.titleSimilarity,
            imageSimilarity: r.imageSimilarity,
          })),
        });
        const byId = new Map(
          matches
            .filter((m) => m.listingId)
            .map((m) => [m.listingId as string, m]),
        );
        results = results.map((r) => {
          const m = byId.get(r.id);
          if (!m) return r;
          return {
            ...r,
            matchingScore: m.matchingScore,
            aiScore: m.aiScore,
            matchingReason: m.reason,
            matchingScores: m.scores,
            titleSimilarity: m.scores.productName / 100,
            imageSimilarity: m.scores.image / 100,
          };
        });
        this.logger.log(
          `SearchJob ${searchJobId}: AI Matching applied to ${matches.length} listing(s) history=${searchHistoryId}`,
        );
      } catch (error) {
        this.logger.warn(
          `SearchJob ${searchJobId} AI Matching skipped history=${searchHistoryId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const result = await this.investigationService.autoCreateFromSearch({
      searchHistoryId,
      searchJobId,
      results,
    });
    if (result.created.length) {
      this.logger.log(
        `SearchJob ${searchJobId}: auto-created ${result.created.length} investigation(s) history=${searchHistoryId}`,
      );
    }
  }

  /** 검색 완료 → BackOffice Callback (COMPLETED / PARTIAL) */
  private async sendBackOfficeCallback(searchJobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: searchJobId } });
    if (!job) return;
    if (job.callbackSentAt) {
      this.logger.debug(`Callback already sent jobId=${searchJobId}`);
      return;
    }
    if (
      job.status !== SearchJobStatus.COMPLETED &&
      job.status !== SearchJobStatus.PARTIAL
    ) {
      return;
    }

    const investigationCount =
      await this.investigationService.countBySearchJobId(searchJobId);
    const completedAt = (job.finishedAt ?? new Date()).toISOString();

    try {
      const keywordSummaries = await this.listKeywordHistories(searchJobId);
      const sent = await this.rentalService.notifySearchCompleted({
        jobId: job.id,
        investigationCount,
        completedAt,
        orderNo: job.orderNo,
        status:
          job.status === SearchJobStatus.PARTIAL ? 'partial' : 'completed',
        // A1: Job resultCount는 고유 매물 수. 키워드별 합계와 다를 수 있음
        resultCount: job.resultCount,
        keywordSummaries,
      });
      if (sent) {
        await this.jobRepo.update(searchJobId, {
          callbackSentAt: new Date(),
          callbackError: null,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `BackOffice callback failed jobId=${searchJobId}: ${message}`,
      );
      await this.jobRepo.update(searchJobId, {
        callbackError: message.slice(0, 1000),
      });
    }
  }

  private getKeywordTimeoutMs(): number {
    const value = this.config.get<number>('searchJob.keywordTimeoutMs');
    return Number.isFinite(value) && (value as number) > 0
      ? (value as number)
      : 180_000;
  }

  private getTotalTimeoutMs(): number {
    const value = this.config.get<number>('searchJob.totalTimeoutMs');
    return Number.isFinite(value) && (value as number) > 0
      ? (value as number)
      : 600_000;
  }

  /** @internal test seam */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toCreateResponse(job: SearchJob) {
    return {
      jobId: job.id,
      orderNo: job.orderNo,
      status: job.status,
      requestedAt: job.requestedAt,
      keywords: job.keywords ?? [],
      progress: job.progress,
    };
  }

  /**
   * 키워드별 검색 내역.
   * resultCount는 키워드가 찾은 수 그대로이며, Job resultCount(고유 매물)와
   * 합계가 다를 수 있다 (A1).
   */
  private async listKeywordHistories(searchJobId: string) {
    const rows = await this.jobHistoryRepo.find({
      where: { searchJobId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      keyword: row.keyword,
      status: row.status,
      resultCount: row.resultCount ?? 0,
      searchHistoryId: row.searchHistoryId,
    }));
  }

  private async toDetailResponse(job: SearchJob) {
    const keywordHistories = await this.listKeywordHistories(job.id);
    return {
      jobId: job.id,
      orderNo: job.orderNo,
      status: job.status,
      requestedAt: job.requestedAt,
      keywords: job.keywords ?? [],
      searchHistoryId: job.searchHistoryId,
      progress: job.progress,
      currentSite: job.currentSite,
      // A1: 고유 매물 수 (키워드별 합계와 다를 수 있음)
      resultCount: job.resultCount,
      errorMessage: job.errorMessage,
      finishedAt: job.finishedAt,
      /** 실행 스냅샷 (마스터 아님) */
      productNameSnapshot: job.productName,
      productNoSnapshot: job.productNo,
      keywordHistories,
    };
  }

  private toMatchingRentalSnapshot(job: SearchJob) {
    return {
      brand: job.brand ?? null,
      productName: job.productName ?? null,
      modelName: job.modelName ?? null,
      option: job.option ?? null,
      color: job.color ?? null,
      imageUrl: job.referenceImageUrl ?? null,
    };
  }
}
