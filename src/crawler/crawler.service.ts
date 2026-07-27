import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdapterRegistry } from './adapter/adapter.registry';
import { NormalizedListing } from './adapter/search-adapter.interface';
import {
  CrawlerResult,
  CrawlerSite,
  ImageHash,
  SearchHistory,
  SearchHistoryResult,
  SearchStatus,
} from '@/database/entities';
import { titleSimilarity, sha256 } from '@/common/utils/string.util';
import {
  computeAverageHash,
  imageSimilarityFromHashes,
} from '@/common/utils/image-hash.util';
import { ElasticService } from '@/elastic/elastic.service';
import { ImageStorageService } from '@/storage/image-storage.service';
import { CrawlProgressPublisher } from '@/progress/crawl-progress.publisher';
import { CrawlProgressStatus } from '@/progress/crawl-progress.types';
import { InvestigationService } from '@/modules/investigation/investigation.service';

export interface CrawlJobPayload {
  searchHistoryId: string;
  keyword: string;
  sites?: string[];
  maxResultsPerSite?: number;
  referenceImageUrl?: string;
  referenceImageHash?: string;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly adapters: AdapterRegistry,
    private readonly elastic: ElasticService,
    private readonly imageStorage: ImageStorageService,
    private readonly progress: CrawlProgressPublisher,
    private readonly investigationService: InvestigationService,
    @InjectRepository(SearchHistory)
    private readonly searchHistoryRepo: Repository<SearchHistory>,
    @InjectRepository(CrawlerResult)
    private readonly resultRepo: Repository<CrawlerResult>,
    @InjectRepository(CrawlerSite)
    private readonly siteRepo: Repository<CrawlerSite>,
    @InjectRepository(ImageHash)
    private readonly imageHashRepo: Repository<ImageHash>,
    @InjectRepository(SearchHistoryResult)
    private readonly historyResultRepo: Repository<SearchHistoryResult>,
  ) {}

  async executeCrawl(payload: CrawlJobPayload): Promise<{
    searchHistoryId: string;
    saved: number;
    errors: string[];
  }> {
    const history = await this.searchHistoryRepo.findOneByOrFail({
      id: payload.searchHistoryId,
    });

    history.status = SearchStatus.RUNNING;
    history.startedAt = history.startedAt || new Date();
    await this.searchHistoryRepo.save(history);

    const adapters = this.adapters.getAll(payload.sites);
    const siteCodes = adapters.map((a) => a.siteCode);
    const completedSites: string[] = [];
    const errors: string[] = [];
    let saved = 0;

    await this.emitProgress({
      searchId: history.id,
      keyword: payload.keyword,
      status: 'running',
      currentSite: null,
      completedSites: [],
      pendingSites: [...siteCodes],
      resultCount: 0,
      totalSites: siteCodes.length,
      message: '크롤 시작',
    });

    for (const adapter of adapters) {
      const pendingSites = siteCodes.filter((s) => !completedSites.includes(s));
      await this.emitProgress({
        searchId: history.id,
        keyword: payload.keyword,
        status: 'running',
        currentSite: adapter.siteCode,
        completedSites: [...completedSites],
        pendingSites,
        resultCount: saved,
        totalSites: siteCodes.length,
        message: `${adapter.siteCode} 검색중`,
      });

      try {
        this.logger.log(
          `Crawl start site=${adapter.siteCode} keyword=${payload.keyword}`,
        );
        const listings = await adapter.crawl({
          keyword: payload.keyword,
          maxResults: payload.maxResultsPerSite ?? 20,
        });

        for (const listing of listings) {
          const created = await this.upsertResult(
            history,
            adapter.siteCode,
            listing,
            payload,
          );
          if (created) {
            saved += 1;
            await this.emitProgress({
              searchId: history.id,
              keyword: payload.keyword,
              status: 'running',
              currentSite: adapter.siteCode,
              completedSites: [...completedSites],
              pendingSites: siteCodes.filter((s) => !completedSites.includes(s)),
              resultCount: saved,
              totalSites: siteCodes.length,
            });
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Crawl failed site=${adapter.siteCode}: ${message}`,
        );
        errors.push(`${adapter.siteCode}: ${message}`);
      }

      completedSites.push(adapter.siteCode);
      await this.emitProgress({
        searchId: history.id,
        keyword: payload.keyword,
        status: 'running',
        currentSite: adapter.siteCode,
        completedSites: [...completedSites],
        pendingSites: siteCodes.filter((s) => !completedSites.includes(s)),
        resultCount: saved,
        totalSites: siteCodes.length,
        message: `${adapter.siteCode} 완료`,
      });
    }

    history.resultCount = await this.historyResultRepo.count({
      where: { searchHistoryId: history.id },
    });
    history.status =
      errors.length === 0
        ? SearchStatus.COMPLETED
        : saved > 0
          ? SearchStatus.PARTIAL
          : SearchStatus.FAILED;
    history.errorMessage = errors.length ? errors.join(' | ') : null;
    history.finishedAt = new Date();
    await this.searchHistoryRepo.save(history);

    const finalStatus = history.status as CrawlProgressStatus;
    await this.emitProgress({
      searchId: history.id,
      keyword: payload.keyword,
      status: finalStatus,
      currentSite: null,
      completedSites: [...completedSites],
      pendingSites: [],
      resultCount: history.resultCount,
      totalSites: siteCodes.length,
      message: '검색 완료',
    });

    if (
      history.status === SearchStatus.COMPLETED ||
      history.status === SearchStatus.PARTIAL
    ) {
      try {
        await this.investigationService.autoCreateFromSearch({
          searchHistoryId: history.id,
        });
      } catch (error) {
        this.logger.warn(
          `Investigation auto-create failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return { searchHistoryId: history.id, saved, errors };
  }

  private async emitProgress( partial: {
    searchId: string;
    keyword: string;
    status: CrawlProgressStatus;
    currentSite: string | null;
    completedSites: string[];
    pendingSites: string[];
    resultCount: number;
    totalSites: number;
    message?: string;
  }) {
    const done = partial.completedSites.length;
    const total = Math.max(partial.totalSites, 1);
    const siteShare = done / total;
    const currentBoost =
      partial.status === 'running' && partial.currentSite ? 0.5 / total : 0;
    let percent = Math.round((siteShare + currentBoost) * 100);
    if (partial.status === 'completed' || partial.status === 'partial') {
      percent = 100;
    } else if (partial.status === 'failed') {
      percent = Math.max(percent, 100);
    }
    percent = Math.max(0, Math.min(100, percent));

    await this.progress.publish({
      ...partial,
      percent,
      at: new Date().toISOString(),
    });
  }

  private async upsertResult(
    history: SearchHistory,
    siteCode: string,
    listing: NormalizedListing,
    payload: CrawlJobPayload,
  ): Promise<boolean> {
    const titleSim = titleSimilarity(payload.keyword, listing.title);
    let imageSim = 0;

    const existing = await this.resultRepo.findOne({
      where: { url: listing.url },
      relations: ['imageHash'],
    });

    let savedResult: CrawlerResult;

    if (existing) {
      // listing 마스터만 갱신. searchHistoryId는 last-seen 참고용.
      existing.searchHistoryId = history.id;
      existing.title = listing.title.slice(0, 500);
      if (listing.price != null) {
        existing.price = String(listing.price);
      }
      if (listing.seller != null) existing.seller = listing.seller;
      if (listing.region != null) existing.region = listing.region;
      if (listing.imageUrl) existing.imageUrl = listing.imageUrl;
      if (listing.description != null) {
        existing.description = listing.description;
      }
      existing.titleSimilarity = titleSim;

      if (payload.referenceImageHash && existing.imageHash?.phash) {
        imageSim = imageSimilarityFromHashes(
          payload.referenceImageHash,
          existing.imageHash.phash,
        );
        existing.imageSimilarity = imageSim;
      }

      savedResult = await this.resultRepo.save(existing);
    } else {
      const site = await this.siteRepo.findOne({ where: { code: siteCode } });
      const contentHash = sha256(
        `${listing.url}|${listing.title}|${listing.price ?? ''}`,
      );

      const result = this.resultRepo.create({
        searchHistoryId: history.id,
        siteId: site?.id ?? null,
        siteCode,
        title: listing.title.slice(0, 500),
        price: listing.price != null ? String(listing.price) : null,
        seller: listing.seller,
        region: listing.region,
        url: listing.url,
        imageUrl: listing.imageUrl,
        description: listing.description,
        contentHash,
        titleSimilarity: titleSim,
        listedAt: listing.listedAt,
        raw: listing.raw ?? null,
      });

      savedResult = await this.resultRepo.save(result);

      let imageHashValue: string | null = null;
      if (listing.imageUrl) {
        try {
          const stored = await this.imageStorage.downloadAndStore(
            listing.imageUrl,
            savedResult.id,
          );
          if (stored) {
            imageHashValue = await computeAverageHash(stored.buffer);
            const imageHash = this.imageHashRepo.create({
              resultId: savedResult.id,
              phash: imageHashValue,
              dhash: null,
              localPath: stored.path,
              sourceUrl: listing.imageUrl,
            });
            await this.imageHashRepo.save(imageHash);

            if (payload.referenceImageHash) {
              imageSim = imageSimilarityFromHashes(
                payload.referenceImageHash,
                imageHashValue,
              );
              savedResult.imageSimilarity = imageSim;
              savedResult = await this.resultRepo.save(savedResult);
            }
          }
        } catch (error) {
          this.logger.warn(
            `Image hash failed for ${listing.url}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    await this.upsertHistorySnapshot(history.id, savedResult, {
      title: listing.title.slice(0, 500),
      price: listing.price != null ? String(listing.price) : savedResult.price,
      seller: listing.seller ?? savedResult.seller,
      region: listing.region ?? savedResult.region,
      imageUrl: listing.imageUrl ?? savedResult.imageUrl,
      titleSimilarity: titleSim,
      imageSimilarity: imageSim || savedResult.imageSimilarity || 0,
    });

    await this.elastic.indexResult({
      id: savedResult.id,
      title: savedResult.title,
      price: listing.price,
      seller: savedResult.seller,
      site: savedResult.siteCode,
      image: savedResult.imageUrl,
      url: savedResult.url,
      createdAt: savedResult.createdAt.toISOString(),
      hash:
        savedResult.contentHash ??
        sha256(`${listing.url}|${listing.title}|${listing.price ?? ''}`),
      keyword: payload.keyword,
      titleSimilarity: titleSim,
      imageSimilarity: imageSim || savedResult.imageSimilarity || 0,
      searchHistoryId: history.id,
      region: savedResult.region,
    });

    return true;
  }

  private async upsertHistorySnapshot(
    searchHistoryId: string,
    result: CrawlerResult,
    snapshot: {
      title: string;
      price: string | null;
      seller: string | null;
      region: string | null;
      imageUrl: string | null;
      titleSimilarity: number;
      imageSimilarity: number;
    },
  ): Promise<void> {
    const existing = await this.historyResultRepo.findOne({
      where: { searchHistoryId, resultId: result.id },
    });

    if (existing) {
      existing.title = snapshot.title;
      existing.price = snapshot.price;
      existing.seller = snapshot.seller;
      existing.region = snapshot.region;
      existing.imageUrl = snapshot.imageUrl;
      existing.titleSimilarity = snapshot.titleSimilarity;
      existing.imageSimilarity = snapshot.imageSimilarity;
      await this.historyResultRepo.save(existing);
      return;
    }

    await this.historyResultRepo.save(
      this.historyResultRepo.create({
        searchHistoryId,
        resultId: result.id,
        ...snapshot,
      }),
    );
  }
}
