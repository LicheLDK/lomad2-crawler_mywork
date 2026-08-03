import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchHistory, SearchStatus } from '@/database/entities';
import { CrawlQueueService } from '@/queue/crawl-queue.service';
import { CreateCrawlDto } from './dto/create-crawl.dto';
import { SiteCode } from '@/common/constants/site-code';
import { AdapterRegistry } from '@/crawler/adapter/adapter.registry';
import { CrawlProgressPublisher } from '@/progress/crawl-progress.publisher';

@Injectable()
export class CrawlService {
  constructor(
    @InjectRepository(SearchHistory)
    private readonly historyRepo: Repository<SearchHistory>,
    private readonly crawlQueue: CrawlQueueService,
    private readonly adapters: AdapterRegistry,
    private readonly progress: CrawlProgressPublisher,
  ) {}

  async enqueue(dto: CreateCrawlDto) {
    const sites = dto.sites?.length ? dto.sites : this.adapters.listCodes();

    const history = await this.historyRepo.save(
      this.historyRepo.create({
        keyword: dto.keyword,
        externalProductId: dto.externalProductId ?? null,
        sites,
        status: SearchStatus.QUEUED,
        requestMeta: {
          forceCrawl: true,
          regions: dto.regions ?? ['all'],
        },
      }),
    );

    const jobId = await this.crawlQueue.enqueueSearchCrawl(
      {
        searchHistoryId: history.id,
        keyword: dto.keyword,
        sites,
        maxResultsPerSite: dto.maxResultsPerSite ?? 20,
        regions: dto.regions ?? ['all'],
      },
      { priority: 1 },
    );

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
      message: '강제 크롤 대기열 등록',
      at: new Date().toISOString(),
    });

    return {
      searchId: history.id,
      jobId,
      status: history.status,
      sites,
    };
  }

  listSites() {
    return this.adapters.listCodes().map((code) => ({
      code,
      name:
        code === SiteCode.JOONGGONARA
          ? '중고나라'
          : code === SiteCode.BUNGAE
            ? '번개장터'
            : code === SiteCode.KARROT
              ? '당근'
              : code,
    }));
  }
}
