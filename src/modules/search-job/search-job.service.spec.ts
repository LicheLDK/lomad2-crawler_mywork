import { SearchJobStatus } from '@/database/entities/search-job.entity';
import { SearchJobService } from './search-job.service';
import { SearchJobProgressSync } from './search-job-progress.sync';

describe('SearchJobService', () => {
  function createService(options?: {
    mockRunSearch?: boolean;
    keywordTimeoutMs?: number;
    totalTimeoutMs?: number;
  }) {
    const mockRunSearch = options?.mockRunSearch !== false;
    const jobRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    };
    const jobHistoryRepo = {
      create: jest.fn((value) => ({
        ...value,
        id: value.id ?? `sjh-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: value.createdAt ?? new Date(),
      })),
      save: jest.fn().mockImplementation(async (value) => value),
      find: jest.fn().mockResolvedValue([]),
    };
    const historyResultRepo = {
      createQueryBuilder: jest.fn(),
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
      autoCreateFromSearch: jest.fn().mockResolvedValue({
        created: [],
        skipped: 0,
        excluded: 0,
        warned: 0,
        threshold: 90,
      }),
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
      canMatch: jest.fn().mockReturnValue(false),
      matchSearchResults: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'searchJob.keywordTimeoutMs') {
          return options?.keywordTimeoutMs ?? 180_000;
        }
        if (key === 'searchJob.totalTimeoutMs') {
          return options?.totalTimeoutMs ?? 600_000;
        }
        return undefined;
      }),
    };

    const service = new SearchJobService(
      jobRepo as never,
      jobHistoryRepo as never,
      historyResultRepo as never,
      searchService as never,
      progressSync as never,
      keywordGenerator as never,
      investigationService as never,
      rentalService as never,
      aiService as never,
      config as never,
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
      historyResultRepo,
      searchService,
      progressSync,
      keywordGenerator,
      investigationService,
      rentalService,
      aiService,
      config,
    };
  }

  function mockDistinctCount(
    historyResultRepo: { createQueryBuilder: jest.Mock },
    count: number,
  ) {
    historyResultRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ cnt: String(count) }),
    });
  }

  /** TypeORM save(entity | entity[]) 모두 처리하는 in-memory history store */
  function bindHistoryStore(
    jobHistoryRepo: {
      save: jest.Mock;
      find: jest.Mock;
    },
    historyStore: Array<Record<string, unknown>>,
  ) {
    const upsert = (row: Record<string, unknown>) => {
      const existing = historyStore.find(
        (h) => h.searchHistoryId === row.searchHistoryId,
      );
      if (existing) {
        Object.assign(existing, row);
        return existing;
      }
      const created = {
        ...row,
        id: row.id ?? `sjh-${historyStore.length}`,
        createdAt: row.createdAt ?? new Date(),
      };
      historyStore.push(created);
      return created;
    };

    jobHistoryRepo.save.mockImplementation(async (row: unknown) => {
      if (Array.isArray(row)) {
        return row.map((r) => upsert(r as Record<string, unknown>));
      }
      return upsert(row as Record<string, unknown>);
    });
    jobHistoryRepo.find.mockImplementation(async () =>
      historyStore.map((h) => ({ ...h })),
    );
  }

  function baseJob(overrides: Record<string, unknown> = {}) {
    return {
      id: 'job-1',
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
      callbackSentAt: null as Date | null,
      orderNo: 'ORDER-1',
      ...overrides,
    };
  }

  it('stores matching snapshots but keeps customer PII null on create', async () => {
    const { service, jobRepo, keywordGenerator, rentalService } =
      createService();
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
      jobHistoryRepo,
      searchService,
      investigationService,
      aiService,
    } = createService();

    jobRepo.findOne.mockResolvedValue({
      id: 'job-1',
      status: SearchJobStatus.COMPLETED,
      brand: 'LG',
      productName: 'Gram 16',
      modelName: '16Z90S',
      option: '32GB RAM',
      color: 'White',
      referenceImageUrl: 'https://example.com/gram.jpg',
      callbackSentAt: new Date(),
    });
    jobHistoryRepo.find.mockResolvedValue([
      {
        searchHistoryId: 'history-1',
        status: 'completed',
      },
    ]);
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

    await (service as any).triggerAutoInvestigation('job-1');

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
    expect(investigationService.autoCreateFromSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        searchHistoryId: 'history-1',
        searchJobId: 'job-1',
      }),
    );
  });

  it('keeps missing brand and model nullable for BackOffice orders', async () => {
    const {
      service,
      jobRepo,
      jobHistoryRepo,
      searchService,
      investigationService,
      aiService,
    } = createService();

    jobRepo.findOne.mockResolvedValue({
      id: 'job-2',
      status: SearchJobStatus.COMPLETED,
      brand: null,
      productName: 'Unknown Product',
      modelName: null,
      option: null,
      color: null,
      referenceImageUrl: null,
      callbackSentAt: new Date(),
    });
    jobHistoryRepo.find.mockResolvedValue([
      { searchHistoryId: 'history-2', status: 'cached' },
    ]);
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
      (service as any).triggerAutoInvestigation('job-2'),
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

  describe('TASK A-3 dual-write (still records N rows)', () => {
    it('creates N search_job_histories rows for N keywords', async () => {
      const {
        service,
        jobRepo,
        jobHistoryRepo,
        historyResultRepo,
        searchService,
      } = createService({ mockRunSearch: false });

      const job = baseJob({ id: 'job-multi' });
      const historyStore: Array<Record<string, unknown>> = [];

      jobRepo.findOne.mockResolvedValue(job);
      jobRepo.save.mockImplementation(async (entity) => entity);
      mockDistinctCount(historyResultRepo, 3);
      bindHistoryStore(jobHistoryRepo, historyStore);
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
        .spyOn(service as any, 'watchJobHistories')
        .mockResolvedValue(undefined);

      await (service as any).runSearch('job-multi');

      expect(jobHistoryRepo.create).toHaveBeenCalledTimes(3);
      expect(historyStore).toHaveLength(3);
      expect(watchSpy).toHaveBeenCalledWith('job-multi');
      expect(job.searchHistoryId).toBe('hist-a');
      expect(job.status).toBe(SearchJobStatus.RUNNING);
    });

    it('does not fail search when dual-write recording throws', async () => {
      const {
        service,
        jobRepo,
        jobHistoryRepo,
        historyResultRepo,
        searchService,
      } = createService({ mockRunSearch: false });

      const job = baseJob({
        id: 'job-warn',
        keywords: ['only-kw'],
      });

      jobRepo.findOne.mockResolvedValue(job);
      jobRepo.save.mockImplementation(async (entity) => entity);
      mockDistinctCount(historyResultRepo, 3);
      searchService.search.mockResolvedValue({
        searchId: 'hist-only',
        status: 'cached',
        source: 'cache',
        resultCount: 3,
      });
      jobHistoryRepo.save.mockRejectedValue(new Error('db unavailable'));
      jobHistoryRepo.find.mockResolvedValue([]);

      const investigateSpy = jest
        .spyOn(service as any, 'triggerAutoInvestigation')
        .mockResolvedValue(undefined);

      await expect(
        (service as any).runSearch('job-warn'),
      ).resolves.toBeUndefined();

      expect(job.status).toBe(SearchJobStatus.COMPLETED);
      expect(investigateSpy).toHaveBeenCalledWith('job-warn');
    });
  });

  describe('TASK A-4 multi-keyword scenarios', () => {
    /** runSearch 가 void 로 띄운 watch 를 테스트에서 await 할 수 있게 감싼다 */
    function captureWatch(service: SearchJobService) {
      const original = (service as any).watchJobHistories.bind(service);
      let pending: Promise<void> = Promise.resolve();
      jest
        .spyOn(service as any, 'watchJobHistories')
        .mockImplementation((id: string) => {
          pending = original(id);
          return pending;
        });
      return {
        awaitWatch: async () => {
          await pending;
        },
      };
    }

    it('all keywords succeed → Job completed after all crawls finish', async () => {
      const {
        service,
        jobRepo,
        jobHistoryRepo,
        historyResultRepo,
        searchService,
        investigationService,
      } = createService({ mockRunSearch: false });

      const job = baseJob({ id: 'job-all-ok' });
      const historyStore: Array<Record<string, unknown>> = [];

      jobRepo.findOne.mockImplementation(async () => job);
      jobRepo.save.mockImplementation(async (entity) => {
        Object.assign(job, entity);
        return job;
      });
      mockDistinctCount(historyResultRepo, 5);
      bindHistoryStore(jobHistoryRepo, historyStore);

      searchService.search
        .mockResolvedValueOnce({
          searchId: 'h1',
          status: 'queued',
          source: 'crawl',
          resultCount: 0,
        })
        .mockResolvedValueOnce({
          searchId: 'h2',
          status: 'queued',
          source: 'crawl',
          resultCount: 0,
        })
        .mockResolvedValueOnce({
          searchId: 'h3',
          status: 'queued',
          source: 'crawl',
          resultCount: 0,
        });

      const pollsById = new Map<string, number>();
      searchService.getSearch.mockImplementation(async (id: string) => {
        const n = (pollsById.get(id) ?? 0) + 1;
        pollsById.set(id, n);
        if (n === 1) {
          return { status: 'running', resultCount: 1, results: [] };
        }
        return {
          status: 'completed',
          resultCount: 2,
          results: [
            { id: `listing-${id}`, title: 'x', siteCode: 'b', url: 'u' },
          ],
        };
      });

      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
      const { awaitWatch } = captureWatch(service);

      await (service as any).runSearch('job-all-ok');
      await awaitWatch();

      expect(job.status).toBe(SearchJobStatus.COMPLETED);
      expect(job.progress).toBe(100);
      expect(job.resultCount).toBe(5);
      expect(historyStore).toHaveLength(3);
      expect(
        historyStore.every((h) => h.status === 'completed'),
      ).toBe(true);
      expect(investigationService.autoCreateFromSearch).toHaveBeenCalledTimes(
        3,
      );
    });

    it('some keywords fail → Job partial', async () => {
      const {
        service,
        jobRepo,
        jobHistoryRepo,
        historyResultRepo,
        searchService,
        investigationService,
      } = createService({ mockRunSearch: false });

      const job = baseJob({ id: 'job-partial', keywords: ['ok', 'bad'] });
      const historyStore: Array<Record<string, unknown>> = [];

      jobRepo.findOne.mockImplementation(async () => job);
      jobRepo.save.mockImplementation(async (entity) => {
        Object.assign(job, entity);
        return job;
      });
      mockDistinctCount(historyResultRepo, 2);
      bindHistoryStore(jobHistoryRepo, historyStore);

      searchService.search
        .mockResolvedValueOnce({
          searchId: 'h-ok',
          status: 'cached',
          source: 'cache',
          resultCount: 2,
        })
        .mockResolvedValueOnce({
          searchId: 'h-bad',
          status: 'queued',
          source: 'crawl',
          resultCount: 0,
        });

      searchService.getSearch.mockImplementation(async (id: string) => {
        if (id === 'h-ok') {
          return {
            status: 'cached',
            resultCount: 2,
            results: [
              { id: 'listing-ok', title: 'ok', siteCode: 'b', url: 'u' },
            ],
          };
        }
        return {
          status: 'failed',
          resultCount: 0,
          results: [],
          errorMessage: 'crawl error',
        };
      });

      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
      const { awaitWatch } = captureWatch(service);

      await (service as any).runSearch('job-partial');
      await awaitWatch();

      expect(job.status).toBe(SearchJobStatus.PARTIAL);
      expect(job.errorMessage).toMatch(/failed or timed out/i);
      expect(investigationService.autoCreateFromSearch).toHaveBeenCalledTimes(
        1,
      );
      expect(investigationService.autoCreateFromSearch).toHaveBeenCalledWith(
        expect.objectContaining({ searchHistoryId: 'h-ok' }),
      );
    });

    it('total timeout marks incomplete rows as timeout and finalizes Job', async () => {
      const {
        service,
        jobRepo,
        jobHistoryRepo,
        historyResultRepo,
        searchService,
      } = createService({
        mockRunSearch: false,
        keywordTimeoutMs: 60_000,
        totalTimeoutMs: 1,
      });

      const job = baseJob({
        id: 'job-timeout',
        keywords: ['a', 'b'],
      });
      const historyStore: Array<Record<string, unknown>> = [];

      jobRepo.findOne.mockImplementation(async () => job);
      jobRepo.save.mockImplementation(async (entity) => {
        Object.assign(job, entity);
        return job;
      });
      mockDistinctCount(historyResultRepo, 0);
      bindHistoryStore(jobHistoryRepo, historyStore);

      searchService.search
        .mockResolvedValueOnce({
          searchId: 'h-a',
          status: 'queued',
          source: 'crawl',
          resultCount: 0,
        })
        .mockResolvedValueOnce({
          searchId: 'h-b',
          status: 'queued',
          source: 'crawl',
          resultCount: 0,
        });

      searchService.getSearch.mockResolvedValue({
        status: 'running',
        resultCount: 0,
        results: [],
      });

      jest.spyOn(service as any, 'sleep').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
      const { awaitWatch } = captureWatch(service);

      await (service as any).runSearch('job-timeout');
      await awaitWatch();

      expect(historyStore).toHaveLength(2);
      expect(historyStore.every((h) => h.status === 'timeout')).toBe(true);
      expect(job.status).toBe(SearchJobStatus.FAILED);
      expect(job.errorMessage).toMatch(/failed or timed out/i);
    });

    it('resultCount uses distinct resultIds across duplicate listings', async () => {
      const {
        service,
        jobRepo,
        jobHistoryRepo,
        historyResultRepo,
        searchService,
      } = createService({ mockRunSearch: false });

      const job = baseJob({
        id: 'job-dup',
        keywords: ['kw1', 'kw2'],
      });
      const historyStore: Array<Record<string, unknown>> = [];

      jobRepo.findOne.mockImplementation(async () => job);
      jobRepo.save.mockImplementation(async (entity) => {
        Object.assign(job, entity);
        return job;
      });
      mockDistinctCount(historyResultRepo, 3);
      bindHistoryStore(jobHistoryRepo, historyStore);

      searchService.search
        .mockResolvedValueOnce({
          searchId: 'h1',
          status: 'cached',
          source: 'cache',
          resultCount: 2,
        })
        .mockResolvedValueOnce({
          searchId: 'h2',
          status: 'cached',
          source: 'cache',
          resultCount: 2,
        });

      const investigateSpy = jest
        .spyOn(service as any, 'triggerAutoInvestigation')
        .mockResolvedValue(undefined);

      await (service as any).runSearch('job-dup');

      expect(job.status).toBe(SearchJobStatus.COMPLETED);
      expect(job.resultCount).toBe(3);
      expect(historyResultRepo.createQueryBuilder).toHaveBeenCalled();
      const keywordSum = historyStore.reduce(
        (s, h) => s + Number(h.resultCount ?? 0),
        0,
      );
      expect(keywordSum).toBe(4);
      expect(job.resultCount).not.toBe(keywordSum);
      expect(investigateSpy).toHaveBeenCalledWith('job-dup');
    });

    it('aggregates progress across keywords while crawling', async () => {
      const {
        service,
        jobRepo,
        jobHistoryRepo,
        historyResultRepo,
        searchService,
      } = createService({ mockRunSearch: false });

      const job = baseJob({
        id: 'job-prog',
        keywords: ['a', 'b'],
      });
      const historyStore: Array<Record<string, unknown>> = [];

      jobRepo.findOne.mockImplementation(async () => job);
      jobRepo.save.mockImplementation(async (entity) => {
        Object.assign(job, entity);
        return job;
      });
      mockDistinctCount(historyResultRepo, 0);
      bindHistoryStore(jobHistoryRepo, historyStore);

      searchService.search
        .mockResolvedValueOnce({
          searchId: 'h-a',
          status: 'queued',
          source: 'crawl',
          resultCount: 0,
        })
        .mockResolvedValueOnce({
          searchId: 'h-b',
          status: 'queued',
          source: 'crawl',
          resultCount: 0,
        });

      const pollsById = new Map<string, number>();
      searchService.getSearch.mockImplementation(async (id: string) => {
        const n = (pollsById.get(id) ?? 0) + 1;
        pollsById.set(id, n);
        if (n === 1) {
          return { status: 'running', resultCount: 0, results: [] };
        }
        return { status: 'completed', resultCount: 1, results: [] };
      });

      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'triggerAutoInvestigation')
        .mockResolvedValue(undefined);
      const { awaitWatch } = captureWatch(service);

      await (service as any).runSearch('job-prog');
      await awaitWatch();

      expect(job.status).toBe(SearchJobStatus.COMPLETED);
      expect(job.progress).toBe(100);
    });
  });
});

describe('SearchJobProgressSync TASK A-4 progress aggregation', () => {
  it('updates history rows and aggregates Job progress across keywords', async () => {
    const job = {
      id: 'job-1',
      searchHistoryId: 'hist-a',
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
    const historyRows = [
      {
        id: 'sjh-1',
        searchJobId: 'job-1',
        searchHistoryId: 'hist-a',
        status: 'queued',
        resultCount: 0,
      },
      {
        id: 'sjh-2',
        searchJobId: 'job-1',
        searchHistoryId: 'hist-b',
        status: 'completed',
        resultCount: 3,
      },
    ];
    const jobHistoryRepo = {
      find: jest
        .fn()
        .mockResolvedValueOnce([historyRows[0]]) // updateJobHistoryFromCrawl
        .mockResolvedValueOnce([historyRows[0]]) // linked jobs
        .mockResolvedValueOnce([
          { ...historyRows[0], status: 'running', resultCount: 4 },
          historyRows[1],
        ]), // all histories for progress
      save: jest.fn().mockImplementation(async (rows) => {
        if (Array.isArray(rows)) {
          historyRows[0].status = rows[0].status;
          historyRows[0].resultCount = rows[0].resultCount;
        }
        return rows;
      }),
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
        searchId: 'hist-a',
        keyword: 'kw-a',
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

    expect(historyRows[0].status).toBe('running');
    expect(historyRows[0].resultCount).toBe(4);
    expect(jobRepo.save).toHaveBeenCalledWith(job);
    // (40 + 100) / 2 = 70
    expect(job.progress).toBe(70);
    expect(job.status).toBe(SearchJobStatus.RUNNING);
    expect(job.finishedAt).toBeNull();
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
      find: jest
        .fn()
        .mockRejectedValueOnce(new Error('history write failed'))
        .mockResolvedValueOnce([]) // linked
        .mockResolvedValueOnce([]),
      save: jest.fn(),
    };
    const config = { get: jest.fn() };
    const sync = new SearchJobProgressSync(
      jobRepo as never,
      jobHistoryRepo as never,
      config as never,
    );
    jest.spyOn(sync, 'publishFromJob').mockResolvedValue({} as never);

    // updateJobHistoryFromCrawl catches; refresh still runs via linked find
    // First find in update throws — caught. Then refreshJobProgressFromHistories
    // calls find for linked — we need that to work.
    jobHistoryRepo.find
      .mockReset()
      .mockRejectedValueOnce(new Error('history write failed'))
      .mockResolvedValueOnce([]) // linked empty
      .mockResolvedValueOnce([]); // unused

    // legacy fallback by searchHistoryId
    jobRepo.findOne
      .mockResolvedValueOnce(job) // legacy lookup
      .mockResolvedValueOnce(job); // load job for update

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
