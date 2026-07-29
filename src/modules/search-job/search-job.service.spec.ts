import { SearchJobStatus } from '@/database/entities/search-job.entity';
import { SearchJobService } from './search-job.service';
import { SearchJobProgressSync } from './search-job-progress.sync';

describe('SearchJobService', () => {
  function createService(options?: { mockRunSearch?: boolean }) {
    const mockRunSearch = options?.mockRunSearch !== false;
    const jobRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    const jobHistoryRepo = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
    };
    const searchService = {
      search: jest.fn(),
      getSearch: jest.fn(),
    };
    const progressSync = {
      publishFromJob: jest.fn().mockResolvedValue(undefined),
      getProgress: jest.fn(),
    };
    const keywordGenerator = {
      generateAsync: jest.fn(),
      generate: jest.fn(),
    };
    const investigationService = {
      autoCreateFromSearch: jest.fn(),
      countBySearchJobId: jest.fn(),
      countBySearchJobIds: jest.fn(),
      listBySearchJobId: jest.fn(),
    };
    const rentalService = {
      resolveSearchInput: jest.fn(),
      notifySearchCompleted: jest.fn(),
      getOrder: jest.fn(),
      toPublicOrder: jest.fn(),
    };
    const aiService = {
      canMatch: jest.fn(),
      matchSearchResults: jest.fn(),
    };

    const service = new SearchJobService(
      jobRepo as never,
      jobHistoryRepo as never,
      searchService as never,
      progressSync as never,
      keywordGenerator as never,
      investigationService as never,
      rentalService as never,
      aiService as never,
    );

    if (mockRunSearch) {
      jest
        .spyOn(service as any, 'runSearch')
        .mockResolvedValue(undefined as void);
    }

    return {
      service,
      jobRepo,
      jobHistoryRepo,
      searchService,
      progressSync,
      keywordGenerator,
      investigationService,
      rentalService,
      aiService,
    };
  }

  it('stores matching snapshots but keeps customer PII null on create', async () => {
    const { service, jobRepo, keywordGenerator, rentalService } = createService();
    const requestedAt = new Date('2026-07-28T09:00:00.000Z');

    rentalService.resolveSearchInput.mockResolvedValue({
      brand: 'Samsung',
      productName: 'Galaxy S24 Ultra',
      modelName: 'SM-S928N',
      option: '512GB',
      color: 'Titanium Gray',
      externalProductId: 'P-100',
      referenceImageUrl: 'https://example.com/ref.jpg',
    });
    keywordGenerator.generateAsync.mockResolvedValue(['Galaxy S24 Ultra']);
    jobRepo.save.mockImplementation(async (entity) => ({
      id: 'job-1',
      requestedAt,
      ...entity,
    }));

    await service.create({
      orderNo: 'ORDER-1',
      useCache: true,
    });

    expect(jobRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNo: 'ORDER-1',
        contractNo: null,
        customerName: null,
        brand: 'Samsung',
        modelName: 'SM-S928N',
        option: '512GB',
        color: 'Titanium Gray',
        productNo: 'P-100',
        productName: 'Galaxy S24 Ultra',
        referenceImageUrl: 'https://example.com/ref.jpg',
        status: SearchJobStatus.PENDING,
      }),
    );
  });

  it('passes brand and model snapshots into AI matching input', async () => {
    const {
      service,
      jobRepo,
      searchService,
      investigationService,
      aiService,
    } = createService();

    jobRepo.findOne.mockResolvedValue({
      id: 'job-1',
      status: SearchJobStatus.PENDING,
      brand: 'LG',
      productName: 'Gram 16',
      modelName: '16Z90S',
      option: '32GB RAM',
      color: 'White',
      referenceImageUrl: 'https://example.com/gram.jpg',
    });
    searchService.getSearch.mockResolvedValue({
      results: [
        {
          id: 'listing-1',
          title: 'LG Gram 16 판매',
          siteCode: 'bungae',
          url: 'https://example.com/listing-1',
          imageUrl: 'https://example.com/listing-1.jpg',
          price: '1500000',
          description: '상태 좋음',
          titleSimilarity: 0.4,
          imageSimilarity: 0.5,
        },
      ],
    });
    aiService.canMatch.mockReturnValue(true);
    aiService.matchSearchResults.mockResolvedValue([
      {
        listingId: 'listing-1',
        matchingScore: 96,
        aiScore: 96,
        reason: '브랜드와 모델이 일치합니다.',
        scores: {
          brand: 100,
          model: 100,
          productName: 95,
          option: 90,
          color: 85,
          image: 80,
          description: 70,
          ocr: 0,
        },
      },
    ]);
    investigationService.autoCreateFromSearch.mockResolvedValue({
      created: [],
      skipped: 0,
      excluded: 0,
      warned: 0,
      threshold: 90,
    });

    await (service as any).triggerAutoInvestigation('job-1', 'history-1');

    expect(aiService.matchSearchResults).toHaveBeenCalledWith(
      expect.objectContaining({
        rental: {
          brand: 'LG',
          productName: 'Gram 16',
          modelName: '16Z90S',
          option: '32GB RAM',
          color: 'White',
          imageUrl: 'https://example.com/gram.jpg',
        },
      }),
    );
  });

  it('keeps missing brand and model nullable for BackOffice orders', async () => {
    const {
      service,
      jobRepo,
      searchService,
      investigationService,
      aiService,
    } = createService();

    jobRepo.findOne.mockResolvedValue({
      id: 'job-2',
      status: SearchJobStatus.PENDING,
      brand: null,
      productName: 'Unknown Product',
      modelName: null,
      option: null,
      color: null,
      referenceImageUrl: null,
    });
    searchService.getSearch.mockResolvedValue({
      results: [
        {
          id: 'listing-2',
          title: '정체불명 상품',
          siteCode: 'karrot',
          url: 'https://example.com/listing-2',
        },
      ],
    });
    aiService.canMatch.mockReturnValue(true);
    aiService.matchSearchResults.mockResolvedValue([]);
    investigationService.autoCreateFromSearch.mockResolvedValue({
      created: [],
      skipped: 0,
      excluded: 0,
      warned: 0,
      threshold: 90,
    });

    await expect(
      (service as any).triggerAutoInvestigation('job-2', 'history-2'),
    ).resolves.toBeUndefined();

    expect(aiService.matchSearchResults).toHaveBeenCalledWith(
      expect.objectContaining({
        rental: {
          brand: null,
          productName: 'Unknown Product',
          modelName: null,
          option: null,
          color: null,
          imageUrl: null,
        },
      }),
    );
    expect(investigationService.autoCreateFromSearch).toHaveBeenCalled();
  });

  describe('TASK A-3 dual-write', () => {
    it('creates N search_job_histories rows for N keywords without changing Job completion path', async () => {
      const {
        service,
        jobRepo,
        jobHistoryRepo,
        searchService,
        progressSync,
      } = createService({ mockRunSearch: false });

      const job = {
        id: 'job-multi',
        keywords: ['kw-a', 'kw-b', 'kw-c'],
        productNo: null,
        sites: null,
        referenceImageUrl: null,
        useCache: true,
        status: SearchJobStatus.PENDING,
        progress: 0,
        resultCount: 0,
        searchHistoryId: null as string | null,
        currentSite: null as string | null,
        finishedAt: null as Date | null,
        errorMessage: null as string | null,
      };

      jobRepo.findOne.mockResolvedValue(job);
      jobRepo.save.mockImplementation(async (entity) => entity);
      searchService.search
        .mockResolvedValueOnce({
          searchId: 'hist-a',
          status: 'cached',
          source: 'cache',
          resultCount: 2,
        })
        .mockResolvedValueOnce({
          searchId: 'hist-b',
          status: 'queued',
          source: 'crawl',
          resultCount: 0,
        })
        .mockResolvedValueOnce({
          searchId: 'hist-c',
          status: 'cached',
          source: 'cache',
          resultCount: 5,
        });

      const watchSpy = jest
        .spyOn(service as any, 'watchHistory')
        .mockResolvedValue(undefined);
      const investigateSpy = jest
        .spyOn(service as any, 'triggerAutoInvestigation')
        .mockResolvedValue(undefined);

      await (service as any).runSearch('job-multi');

      expect(jobHistoryRepo.create).toHaveBeenCalledTimes(3);
      expect(jobHistoryRepo.save).toHaveBeenCalledTimes(3);
      expect(jobHistoryRepo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          searchJobId: 'job-multi',
          keyword: 'kw-a',
          searchHistoryId: 'hist-a',
          status: 'cached',
          resultCount: 2,
        }),
      );
      expect(jobHistoryRepo.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          searchJobId: 'job-multi',
          keyword: 'kw-b',
          searchHistoryId: 'hist-b',
          status: 'queued',
          resultCount: 0,
        }),
      );
      expect(jobHistoryRepo.create).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          searchJobId: 'job-multi',
          keyword: 'kw-c',
          searchHistoryId: 'hist-c',
          status: 'cached',
          resultCount: 5,
        }),
      );

      // 기존 동작: 첫 크롤 히스토리만 watch, Job resultCount는 키워드 합산
      expect(watchSpy).toHaveBeenCalledWith('job-multi', 'hist-b');
      expect(investigateSpy).not.toHaveBeenCalled();
      expect(job.searchHistoryId).toBe('hist-b');
      expect(job.resultCount).toBe(7);
      expect(job.status).toBe(SearchJobStatus.RUNNING);
      expect(progressSync.publishFromJob).toHaveBeenCalled();
    });

    it('does not fail search when dual-write recording throws', async () => {
      const {
        service,
        jobRepo,
        jobHistoryRepo,
        searchService,
      } = createService({ mockRunSearch: false });

      const job = {
        id: 'job-warn',
        keywords: ['only-kw'],
        productNo: null,
        sites: null,
        referenceImageUrl: null,
        useCache: true,
        status: SearchJobStatus.PENDING,
        progress: 0,
        resultCount: 0,
        searchHistoryId: null as string | null,
        currentSite: null as string | null,
        finishedAt: null as Date | null,
        errorMessage: null as string | null,
      };

      jobRepo.findOne.mockResolvedValue(job);
      jobRepo.save.mockImplementation(async (entity) => entity);
      searchService.search.mockResolvedValue({
        searchId: 'hist-only',
        status: 'cached',
        source: 'cache',
        resultCount: 3,
      });
      jobHistoryRepo.save.mockRejectedValue(new Error('db unavailable'));

      const investigateSpy = jest
        .spyOn(service as any, 'triggerAutoInvestigation')
        .mockResolvedValue(undefined);

      await expect(
        (service as any).runSearch('job-warn'),
      ).resolves.toBeUndefined();

      expect(job.status).toBe(SearchJobStatus.COMPLETED);
      expect(job.resultCount).toBe(3);
      expect(investigateSpy).toHaveBeenCalledWith('job-warn', 'hist-only');
    });
  });
});

describe('SearchJobProgressSync TASK A-3 dual-write', () => {
  it('updates matching search_job_histories status and resultCount from crawl progress', async () => {
    const jobRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const historyRow = {
      id: 'sjh-1',
      searchJobId: 'job-1',
      searchHistoryId: 'hist-secondary',
      status: 'queued',
      resultCount: 0,
    };
    const jobHistoryRepo = {
      find: jest.fn().mockResolvedValue([historyRow]),
      save: jest.fn().mockResolvedValue([historyRow]),
    };
    const config = {
      get: jest.fn(),
    };

    const sync = new SearchJobProgressSync(
      jobRepo as never,
      jobHistoryRepo as never,
      config as never,
    );

    await (sync as any).onCrawlProgress(
      JSON.stringify({
        searchId: 'hist-secondary',
        keyword: 'kw-b',
        status: 'running',
        percent: 40,
        currentSite: 'bungae',
        completedSites: [],
        pendingSites: ['bungae'],
        resultCount: 4,
        totalSites: 1,
        at: new Date().toISOString(),
      }),
    );

    expect(jobHistoryRepo.find).toHaveBeenCalledWith({
      where: { searchHistoryId: 'hist-secondary' },
    });
    expect(historyRow.status).toBe('running');
    expect(historyRow.resultCount).toBe(4);
    expect(jobHistoryRepo.save).toHaveBeenCalledWith([historyRow]);
    // 대표 히스토리가 아니면 Job 갱신은 하지 않음 (기존 동작)
    expect(jobRepo.save).not.toHaveBeenCalled();
  });

  it('continues Job sync when history dual-write fails', async () => {
    const job = {
      id: 'job-1',
      searchHistoryId: 'hist-primary',
      status: SearchJobStatus.RUNNING,
      progress: 20,
      currentSite: null as string | null,
      resultCount: 0,
      finishedAt: null as Date | null,
      errorMessage: null as string | null,
    };
    const jobRepo = {
      findOne: jest.fn().mockResolvedValue(job),
      save: jest.fn().mockResolvedValue(job),
    };
    const jobHistoryRepo = {
      find: jest.fn().mockRejectedValue(new Error('history write failed')),
      save: jest.fn(),
    };
    const config = { get: jest.fn() };
    const sync = new SearchJobProgressSync(
      jobRepo as never,
      jobHistoryRepo as never,
      config as never,
    );
    jest.spyOn(sync, 'publishFromJob').mockResolvedValue({} as never);

    await (sync as any).onCrawlProgress(
      JSON.stringify({
        searchId: 'hist-primary',
        keyword: 'kw-a',
        status: 'running',
        percent: 55,
        currentSite: 'karrot',
        completedSites: [],
        pendingSites: ['karrot'],
        resultCount: 1,
        totalSites: 1,
        at: new Date().toISOString(),
      }),
    );

    expect(jobRepo.save).toHaveBeenCalledWith(job);
    expect(job.progress).toBe(55);
  });
});
