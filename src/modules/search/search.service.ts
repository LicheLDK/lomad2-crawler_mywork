import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  CrawlerResult,
  SearchHistory,
  SearchKeyword,
  SearchStatus,
} from '@/database/entities';
import { CreateSearchDto } from './dto/create-search.dto';
import { QueryResultDto } from './dto/query-result.dto';
import { ElasticService } from '@/elastic/elastic.service';
import { CrawlQueueService } from '@/queue/crawl-queue.service';
import { normalizeKeyword } from '@/common/utils/string.util';
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
    const useCache = dto.useCache !== false;

    await this.upsertKeyword(keyword);

    if (useCache) {
      const cached = await this.elastic.search({
        keyword: dto.keyword,
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
            finishedAt: new Date(),
            requestMeta: { source: 'elastic-cache' },
          }),
        );

        return {
          searchId: history.id,
          status: history.status,
          source: 'cache',
          resultCount: cached.length,
          results: cached,
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
            finishedAt: new Date(),
            requestMeta: { source: 'cache-only-miss' },
          }),
        );
        return {
          searchId: history.id,
          status: history.status,
          source: 'cache',
          resultCount: 0,
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
        },
      }),
    );

    const jobId = await this.crawlQueue.enqueueSearchCrawl({
      searchHistoryId: history.id,
      keyword: dto.keyword,
      sites,
      maxResultsPerSite: dto.maxResultsPerSite ?? 20,
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
      await this.resultRepo.find({
        where: { searchHistoryId: id },
        relations: ['imageHash'],
        order: { createdAt: 'DESC' },
        take: 100,
      })
    ).map((r) => this.toResultDto(r));

    // Elastic 캐시 히트 이력은 crawler_result에 searchHistoryId가 연결되지 않음
    // → DB 결과가 비어 있으면 Elastic에서 동일 키워드로 재조회
    if (
      results.length === 0 &&
      (history.status === SearchStatus.CACHED || history.resultCount > 0)
    ) {
      const cached = await this.elastic.search({
        keyword: history.keyword,
        sites: history.sites ?? undefined,
        size: Math.max(history.resultCount || 50, 50),
      });
      results = cached.map((doc) => ({
        id: doc.id,
        searchHistoryId: history.id,
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
      }));
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

  async getResults(query: QueryResultDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
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
    if (query.searchId) {
      qb.andWhere('r.searchHistoryId = :searchId', {
        searchId: query.searchId,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      page,
      limit,
      total,
      items: items.map((r) => this.toResultDto(r)),
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
      screenshotUrl: r.imageHash?.localPath
        ? `storage/images/${r.id}`
        : null,
    };
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
