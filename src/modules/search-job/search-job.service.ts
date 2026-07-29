import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SearchJob,
  SearchJobStatus,
} from '@/database/entities/search-job.entity';
import { SearchJobHistory } from '@/database/entities/search-job-history.entity';
import { SearchService } from '@/modules/search/search.service';
import { CreateSearchJobDto } from './dto/create-search-job.dto';
import { SearchJobProgressSync } from './search-job-progress.sync';
import { SearchKeywordGeneratorService } from './search-keyword-generator.service';
import { InvestigationService } from '@/modules/investigation/investigation.service';
import { RentalService } from '@/api/rental.service';
import { AiService } from '@/ai/ai.service';

@Injectable()
export class SearchJobService {
  private readonly logger = new Logger(SearchJobService.name);

  constructor(
    @InjectRepository(SearchJob)
    private readonly jobRepo: Repository<SearchJob>,
    @InjectRepository(SearchJobHistory)
    private readonly jobHistoryRepo: Repository<SearchJobHistory>,
    private readonly searchService: SearchService,
    private readonly progressSync: SearchJobProgressSync,
    private readonly keywordGenerator: SearchKeywordGeneratorService,
    private readonly investigationService: InvestigationService,
    private readonly rentalService: RentalService,
    private readonly aiService: AiService,
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
    return {
      jobId: event.jobId,
      status: event.status,
      currentSite: event.currentSite,
      progress: event.progress,
      resultCount: event.resultCount,
      searchHistoryId: event.searchHistoryId,
      message: event.message,
      at: event.at,
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
      job: this.toDetailResponse(job),
      order,
      orderError,
      searchHistories,
      investigations,
      investigationCount: investigations.length,
    };
  }

  /** @deprecated use listRecentJobs — 호환 별칭 */
  async listRecentRentalOrders(limit = 40) {
    return this.listRecentJobs(limit);
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

      // 다중 검색어: 순차 실행. 첫 크롤 대기 Job 이 있으면 watch 후 마무리
      let pendingWatchId: string | null = null;
      let totalResults = 0;
      let primaryHistoryId: string | null = null;
      let anySuccess = false;

      for (let i = 0; i < keywords.length; i++) {
        const keyword = keywords[i];
        const pct = 10 + Math.floor((i / keywords.length) * 70);
        job.progress = Math.min(80, pct);
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

        // TASK A-3: 이중 쓰기 — 완료 판정/집계는 기존 로직 유지
        await this.recordJobHistory(job.id, keyword, result);

        if (result.status === 'failed') {
          this.logger.warn(
            `SearchJob ${job.id} keyword failed: ${keyword}`,
          );
          continue;
        }

        anySuccess = true;
        if (!primaryHistoryId) {
          primaryHistoryId = result.searchId;
          job.searchHistoryId = result.searchId;
        }

        totalResults += result.resultCount ?? 0;
        job.resultCount = totalResults;

        const terminalCached =
          result.status === 'cached' ||
          result.status === 'completed' ||
          result.status === 'partial';

        if (!terminalCached && result.source !== 'cache') {
          if (!pendingWatchId) {
            pendingWatchId = result.searchId;
            job.searchHistoryId = result.searchId;
          }
        }
      }

      job.resultCount = totalResults;

      if (pendingWatchId) {
        job.status = SearchJobStatus.RUNNING;
        job.progress = Math.max(job.progress, 20);
        await this.jobRepo.save(job);
        await this.progressSync.publishFromJob(job, 'Crawling');
        void this.watchHistory(job.id, pendingWatchId);
      } else if (anySuccess && primaryHistoryId) {
        job.status = SearchJobStatus.COMPLETED;
        job.progress = 100;
        job.currentSite = null;
        job.finishedAt = new Date();
        job.errorMessage = null;
        await this.jobRepo.save(job);
        await this.progressSync.publishFromJob(job, 'Completed');
        void this.triggerAutoInvestigation(job.id, primaryHistoryId);
      } else {
        job.status = SearchJobStatus.FAILED;
        job.finishedAt = new Date();
        job.errorMessage = 'All keyword searches failed';
        await this.jobRepo.save(job);
        await this.progressSync.publishFromJob(job, 'Failed');
      }

      this.logger.log(
        `SearchJob ${job.id} keywords=${keywords.length} history=${job.searchHistoryId} status=${job.status}`,
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
   * TASK A-3 이중 쓰기: search_job_histories 에 키워드별 행을 기록한다.
   * 기록 실패는 검색 실패로 전파하지 않는다 (관찰용).
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

      const terminalCached =
        result.status === 'cached' ||
        result.status === 'completed' ||
        result.status === 'partial';
      const needsCrawl = !terminalCached && result.source !== 'cache';

      await this.jobHistoryRepo.save(
        this.jobHistoryRepo.create({
          searchJobId,
          keyword,
          searchHistoryId: result.searchId,
          status: needsCrawl ? 'queued' : String(result.status ?? 'queued'),
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

  /** 크롤이 끝날 때까지 search_history 상태를 Job 에 반영 */
  private async watchHistory(
    jobId: string,
    searchHistoryId: string,
  ): Promise<void> {
    const terminal = new Set([
      'completed',
      'partial',
      'failed',
      'cached',
    ]);
    const maxAttempts = 90;

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(2000);
      try {
        const detail = await this.searchService.getSearch(searchHistoryId);
        const job = await this.jobRepo.findOne({ where: { id: jobId } });
        if (!job) return;

        job.resultCount = Math.max(
          job.resultCount ?? 0,
          detail.resultCount ?? 0,
        );

        if (!terminal.has(detail.status)) {
          if (job.status === SearchJobStatus.RUNNING) {
            await this.jobRepo.save(job);
            await this.progressSync.publishFromJob(job, 'Crawling');
          }
          continue;
        }

        job.status =
          detail.status === 'failed'
            ? SearchJobStatus.FAILED
            : SearchJobStatus.COMPLETED;
        job.errorMessage =
          detail.status === 'failed'
            ? detail.errorMessage || 'Search failed'
            : null;
        job.finishedAt = new Date();
        job.progress = detail.status === 'failed' ? job.progress : 100;
        job.currentSite = null;
        await this.jobRepo.save(job);
        await this.progressSync.publishFromJob(
          job,
          detail.status === 'failed' ? 'Failed' : 'Completed',
        );
        if (detail.status !== 'failed') {
          void this.triggerAutoInvestigation(jobId, searchHistoryId);
        }
        this.logger.log(
          `SearchJob ${jobId} finished via history status=${detail.status}`,
        );
        return;
      } catch (error) {
        this.logger.warn(
          `SearchJob ${jobId} watch error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    await this.jobRepo.update(jobId, {
      status: SearchJobStatus.FAILED,
      errorMessage: 'Search timed out while waiting for crawl',
      finishedAt: new Date(),
    });
    const timedOut = await this.jobRepo.findOne({ where: { id: jobId } });
    if (timedOut) {
      await this.progressSync.publishFromJob(timedOut, 'Timed out');
    }
  }

  private async triggerAutoInvestigation(
    searchJobId: string,
    searchHistoryId: string,
  ): Promise<void> {
    try {
      const job = await this.jobRepo.findOne({ where: { id: searchJobId } });
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

      // AI Matching Engine — 렌탈 상품 vs 검색 결과
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
              // heuristic 필드도 AI 점수로 보강 (0~1)
              titleSimilarity: m.scores.productName / 100,
              imageSimilarity: m.scores.image / 100,
            };
          });
          this.logger.log(
            `SearchJob ${searchJobId}: AI Matching applied to ${matches.length} listing(s)`,
          );
        } catch (error) {
          this.logger.warn(
            `SearchJob ${searchJobId} AI Matching skipped: ${
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
          `SearchJob ${searchJobId}: auto-created ${result.created.length} investigation(s)`,
        );
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

  /** 검색 완료 → BackOffice Callback (Job ID · Investigation Count · Completed At) */
  private async sendBackOfficeCallback(searchJobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: searchJobId } });
    if (!job) return;
    if (job.callbackSentAt) {
      this.logger.debug(`Callback already sent jobId=${searchJobId}`);
      return;
    }
    if (job.status !== SearchJobStatus.COMPLETED) return;

    const investigationCount =
      await this.investigationService.countBySearchJobId(searchJobId);
    const completedAt = (job.finishedAt ?? new Date()).toISOString();

    try {
      const sent = await this.rentalService.notifySearchCompleted({
        jobId: job.id,
        investigationCount,
        completedAt,
        orderNo: job.orderNo,
        status: 'completed',
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

  private toDetailResponse(job: SearchJob) {
    return {
      jobId: job.id,
      orderNo: job.orderNo,
      status: job.status,
      requestedAt: job.requestedAt,
      keywords: job.keywords ?? [],
      searchHistoryId: job.searchHistoryId,
      progress: job.progress,
      currentSite: job.currentSite,
      resultCount: job.resultCount,
      errorMessage: job.errorMessage,
      finishedAt: job.finishedAt,
      /** 실행 스냅샷 (마스터 아님) */
      productNameSnapshot: job.productName,
      productNoSnapshot: job.productNo,
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
