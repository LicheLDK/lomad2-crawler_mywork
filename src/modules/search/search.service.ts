import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  CrawlerResult,
  InvestigationCaseEntity,
  SearchHistory,
  SearchHistoryResult,
  SearchJob,
  SearchKeyword,
  SearchStatus,
} from '@/database/entities';
import { CreateSearchDto } from './dto/create-search.dto';
import { QueryResultDto } from './dto/query-result.dto';
import { ElasticService } from '@/elastic/elastic.service';
import { CrawlQueueService } from '@/queue/crawl-queue.service';
import { normalizeKeyword } from '@/common/utils/string.util';
import { isNationwideRegions } from '@/common/constants/search-region';
import { SiteCode } from '@/common/constants/site-code';
import { CacheService } from '@/modules/cache/cache.service';
import { ImageStorageService } from '@/storage/image-storage.service';
import { computeAverageHash } from '@/common/utils/image-hash.util';
import { CrawlProgressPublisher } from '@/progress/crawl-progress.publisher';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(SearchHistory)
    private readonly historyRepo: Repository<SearchHistory>,
    @InjectRepository(SearchKeyword)
    private readonly keywordRepo: Repository<SearchKeyword>,
    @InjectRepository(CrawlerResult)
    private readonly resultRepo: Repository<CrawlerResult>,
    @InjectRepository(SearchHistoryResult)
    private readonly historyResultRepo: Repository<SearchHistoryResult>,
    @InjectRepository(SearchJob)
    private readonly jobRepo: Repository<SearchJob>,
    @InjectRepository(InvestigationCaseEntity)
    private readonly investigationRepo: Repository<InvestigationCaseEntity>,
    private readonly elastic: ElasticService,
    private readonly crawlQueue: CrawlQueueService,
    private readonly cache: CacheService,
    private readonly imageStorage: ImageStorageService,
    private readonly config: ConfigService,
    private readonly progress: CrawlProgressPublisher,
  ) {}

  async search(dto: CreateSearchDto) {
    const keyword = normalizeKeyword(dto.keyword);
    const sites =
      dto.sites?.length && dto.sites.length > 0
        ? dto.sites
        : [...SiteCode.ALL];
    const regions = dto.regions?.length ? dto.regions : ['all'];
    // 지역 필터 결과는 Elastic 키워드 캐시와 범위가 달라 전국일 때만 캐시 사용
    const useCache = dto.useCache !== false && isNationwideRegions(regions);

    await this.upsertKeyword(keyword);

    if (useCache) {
      const cached = await this.elastic.searchExactKeyword({
        keyword: dto.keyword.trim(),
        sites,
        size: 50,
      });

      if (cached.length > 0) {
        const history = await this.historyRepo.save(
          this.historyRepo.create({
            keyword: dto.keyword,
            externalProductId: dto.externalProductId ?? null,
            sites,
            status: SearchStatus.CACHED,
            resultCount: cached.length,
            startedAt: new Date(),
            finishedAt: new Date(),
            requestMeta: { source: 'elastic-cache', regions },
          }),
        );

        await this.linkCachedResults(history.id, cached);
        const results = cached.map((doc) => this.fromElasticDoc(doc, history.id));

        return {
          searchId: history.id,
          keyword: history.keyword,
          status: history.status,
          source: 'cache',
          resultCount: cached.length,
          sites: history.sites,
          startedAt: history.startedAt,
          finishedAt: history.finishedAt,
          createdAt: history.createdAt,
          results,
        };
      }

      if (dto.cacheOnly) {
        const history = await this.historyRepo.save(
          this.historyRepo.create({
            keyword: dto.keyword,
            externalProductId: dto.externalProductId ?? null,
            sites,
            status: SearchStatus.COMPLETED,
            resultCount: 0,
            startedAt: new Date(),
            finishedAt: new Date(),
            requestMeta: { source: 'cache-only-miss' },
          }),
        );
        return {
          searchId: history.id,
          keyword: history.keyword,
          status: history.status,
          source: 'cache',
          resultCount: 0,
          sites: history.sites,
          startedAt: history.startedAt,
          finishedAt: history.finishedAt,
          createdAt: history.createdAt,
          results: [],
        };
      }
    }

    let referenceImageHash: string | undefined;
    if (dto.referenceImageUrl) {
      const stored = await this.imageStorage.downloadAndStore(
        dto.referenceImageUrl,
        `ref-${Date.now()}`,
      );
      if (stored) {
        referenceImageHash = await computeAverageHash(stored.buffer);
      }
    }

    const history = await this.historyRepo.save(
      this.historyRepo.create({
        keyword: dto.keyword,
        externalProductId: dto.externalProductId ?? null,
        sites,
        status: SearchStatus.QUEUED,
        requestMeta: {
          maxResultsPerSite: dto.maxResultsPerSite ?? 20,
          referenceImageUrl: dto.referenceImageUrl,
          regions,
        },
      }),
    );

    const jobId = await this.crawlQueue.enqueueSearchCrawl({
      searchHistoryId: history.id,
      keyword: dto.keyword,
      sites,
      maxResultsPerSite: dto.maxResultsPerSite ?? 20,
      regions,
      referenceImageUrl: dto.referenceImageUrl,
      referenceImageHash,
    });

    await this.cache.setSearchJob(history.id, jobId);

    this.logger.log(`Search queued id=${history.id} job=${jobId}`);

    await this.progress.publish({
      searchId: history.id,
      keyword: dto.keyword,
      status: 'queued',
      percent: 2,
      currentSite: null,
      completedSites: [],
      pendingSites: [...sites],
      resultCount: 0,
      totalSites: sites.length,
      message: '대기열 등록',
      at: new Date().toISOString(),
    });

    return {
      searchId: history.id,
      status: history.status,
      source: 'crawl',
      jobId,
      resultCount: 0,
      results: [],
    };
  }

  async getSearch(id: string) {
    const history = await this.historyRepo.findOne({ where: { id } });
    if (!history) {
      throw new NotFoundException(`Search not found: ${id}`);
    }

    let results: unknown[] = (
      await this.historyResultRepo.find({
        where: { searchHistoryId: id },
        relations: ['result', 'result.imageHash'],
        order: { createdAt: 'DESC' },
        take: 100,
      })
    ).map((link) => this.toSnapshotDto(link));

    // Elastic 캐시 히트 이력은 listing이 없으면 스냅샷이 비어 있을 수 있음
    if (
      results.length === 0 &&
      (history.status === SearchStatus.CACHED || history.resultCount > 0)
    ) {
      const cached = await this.elastic.searchExactKeyword({
        keyword: history.keyword,
        sites: history.sites ?? undefined,
        size: Math.max(history.resultCount || 50, 50),
      });
      results = cached.map((doc) => this.fromElasticDoc(doc, history.id));
    }

    return {
      searchId: history.id,
      keyword: history.keyword,
      status: history.status,
      resultCount: Math.max(history.resultCount, results.length),
      sites: history.sites,
      errorMessage: history.errorMessage,
      startedAt: history.startedAt,
      finishedAt: history.finishedAt,
      createdAt: history.createdAt,
      referenceImageUrl:
        typeof history.requestMeta?.referenceImageUrl === 'string'
          ? history.requestMeta.referenceImageUrl
          : null,
      results,
    };
  }

  /**
   * 검색 이력 단건 삭제.
   * - Investigation: 해당 history 케이스 삭제
   * - SearchJob: searchHistoryId만 null (주문 job 자체는 유지)
   * - search_history_results: history CASCADE
   * - orphan crawler_result(+image_hash) 및 ES _id만 정리
   * - Redis search:job:{id}
   */
  async deleteSearch(id: string) {
    const history = await this.historyRepo.findOne({ where: { id } });
    if (!history) {
      throw new NotFoundException(`Search not found: ${id}`);
    }

    const links = await this.historyResultRepo.find({
      where: { searchHistoryId: id },
    });
    const linkedResultIds = [...new Set(links.map((l) => l.resultId))];

    const investigationResult = await this.investigationRepo.delete({
      searchHistoryId: id,
    });
    const deletedInvestigations = investigationResult.affected ?? 0;

    const jobResult = await this.jobRepo.update(
      { searchHistoryId: id },
      { searchHistoryId: null },
    );
    const clearedJobs = jobResult.affected ?? 0;

    await this.historyRepo.delete({ id });

    const orphanIds: string[] = [];
    for (const resultId of linkedResultIds) {
      const stillLinked = await this.historyResultRepo.exist({
        where: { resultId },
      });
      if (!stillLinked) {
        orphanIds.push(resultId);
      }
    }

    let orphanListingsDeleted = 0;
    if (orphanIds.length > 0) {
      const del = await this.resultRepo.delete(orphanIds);
      orphanListingsDeleted = del.affected ?? 0;
      await this.elastic.deleteByIds(orphanIds);
    }

    await this.cache.deleteSearchJob(id);

    const normalizedKeyword = normalizeKeyword(history.keyword);
    const remainingForKeyword = await this.historyRepo
      .createQueryBuilder('h')
      .where(
        `LOWER(REGEXP_REPLACE(TRIM(h.keyword), '\\s+', ' ', 'g')) = :kw`,
        { kw: normalizedKeyword },
      )
      .getCount();
    if (remainingForKeyword === 0) {
      await this.keywordRepo.delete({ keyword: normalizedKeyword });
    }

    this.logger.log(
      `Deleted search=${id} investigations=${deletedInvestigations} jobsCleared=${clearedJobs} orphans=${orphanListingsDeleted}`,
    );

    return {
      success: true,
      searchId: id,
      deletedInvestigations,
      clearedJobs,
      orphanListingsDeleted,
    };
  }

  async getResults(query: QueryResultDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (query.searchId) {
      const qb = this.historyResultRepo
        .createQueryBuilder('shr')
        .leftJoinAndSelect('shr.result', 'r')
        .leftJoinAndSelect('r.imageHash', 'imageHash')
        .where('shr.searchHistoryId = :searchId', {
          searchId: query.searchId,
        })
        .orderBy('shr.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      if (query.keyword) {
        qb.andWhere('shr.title ILIKE :kw', { kw: `%${query.keyword}%` });
      }
      if (query.site) {
        qb.andWhere('r.siteCode = :site', { site: query.site });
      }

      const [items, total] = await qb.getManyAndCount();
      return {
        page,
        limit,
        total,
        items: items.map((link) => this.toSnapshotDto(link)),
      };
    }

    const qb = this.resultRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.imageHash', 'imageHash')
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.keyword) {
      qb.andWhere('r.title ILIKE :kw', { kw: `%${query.keyword}%` });
    }
    if (query.site) {
      qb.andWhere('r.siteCode = :site', { site: query.site });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      page,
      limit,
      total,
      items: items.map((r) => this.toResultDto(r)),
    };
  }

  /** Elastic 문서 → 프론트 공통 Result DTO */
  private fromElasticDoc(
    doc: {
      id: string;
      title: string;
      price: number | null;
      seller: string | null;
      site: string;
      image: string | null;
      url: string;
      createdAt: string;
      titleSimilarity?: number | null;
      imageSimilarity?: number | null;
      region?: string | null;
    },
    searchHistoryId: string,
  ) {
    return {
      id: doc.id,
      searchHistoryId,
      siteCode: doc.site,
      title: doc.title,
      price: doc.price != null ? String(doc.price) : null,
      seller: doc.seller,
      region: doc.region ?? null,
      url: doc.url,
      imageUrl: doc.image,
      screenshotUrl: null,
      titleSimilarity: doc.titleSimilarity ?? null,
      imageSimilarity: doc.imageSimilarity ?? null,
      createdAt: doc.createdAt,
      source: 'elastic-cache',
    };
  }

  private toSnapshotDto(link: SearchHistoryResult) {
    const r = link.result;
    return {
      id: r?.id ?? link.resultId,
      searchHistoryId: link.searchHistoryId,
      siteCode: r?.siteCode ?? null,
      title: link.title,
      price: link.price,
      seller: link.seller,
      region: link.region,
      url: r?.url ?? null,
      imageUrl: link.imageUrl,
      description: r?.description ?? null,
      titleSimilarity: link.titleSimilarity,
      imageSimilarity: link.imageSimilarity,
      matchingScore: link.matchingScore,
      aiScore: link.aiScore,
      matchingReason: link.matchingReason,
      matchingScores: link.matchingScores,
      createdAt: link.createdAt,
      listedAt: r?.listedAt ?? null,
      screenshotUrl: r?.imageHash?.localPath
        ? `storage/images/${r.id}`
        : null,
    };
  }

  private toResultDto(r: CrawlerResult) {
    return {
      id: r.id,
      searchHistoryId: r.searchHistoryId,
      siteCode: r.siteCode,
      title: r.title,
      price: r.price,
      seller: r.seller,
      region: r.region,
      url: r.url,
      imageUrl: r.imageUrl,
      description: r.description,
      titleSimilarity: r.titleSimilarity,
      imageSimilarity: r.imageSimilarity,
      createdAt: r.createdAt,
      listedAt: r.listedAt,
      screenshotUrl: r.imageHash?.localPath
        ? `storage/images/${r.id}`
        : null,
    };
  }

  /** Elastic 캐시 히트 시 DB listing이 있으면 스냅샷 링크 생성 */
  private async linkCachedResults(
    searchHistoryId: string,
    docs: Array<{
      id: string;
      title: string;
      price: number | null;
      seller: string | null;
      image: string | null;
      region?: string | null;
      titleSimilarity?: number | null;
      imageSimilarity?: number | null;
    }>,
  ): Promise<void> {
    for (const doc of docs) {
      const listing = await this.resultRepo.findOne({
        where: { id: doc.id },
      });
      if (!listing) continue;

      const exists = await this.historyResultRepo.findOne({
        where: { searchHistoryId, resultId: listing.id },
      });
      if (exists) continue;

      await this.historyResultRepo.save(
        this.historyResultRepo.create({
          searchHistoryId,
          resultId: listing.id,
          title: doc.title.slice(0, 500),
          price: doc.price != null ? String(doc.price) : listing.price,
          seller: doc.seller ?? listing.seller,
          region: doc.region ?? listing.region,
          imageUrl: doc.image ?? listing.imageUrl,
          titleSimilarity: doc.titleSimilarity ?? 0,
          imageSimilarity: doc.imageSimilarity ?? 0,
        }),
      );
    }
  }

  private async upsertKeyword(keyword: string): Promise<SearchKeyword> {
    let entity = await this.keywordRepo.findOne({ where: { keyword } });
    if (!entity) {
      entity = this.keywordRepo.create({
        keyword,
        searchCount: 1,
        lastSearchedAt: new Date(),
      });
    } else {
      entity.searchCount += 1;
      entity.lastSearchedAt = new Date();
    }
    return this.keywordRepo.save(entity);
  }
}
