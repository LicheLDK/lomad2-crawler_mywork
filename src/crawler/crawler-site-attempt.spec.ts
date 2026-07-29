import { CrawlerService } from './crawler.service';
import { CrawlAdapterError } from './adapter/crawl-adapter.error';
import { SearchHistory, SearchStatus } from '@/database/entities';

describe('CrawlerService site attempt recording (TASK B-3)', () => {
  const history: SearchHistory = {
    id: 'hist-1',
    status: SearchStatus.QUEUED,
    startedAt: null,
    finishedAt: null,
    resultCount: 0,
    errorMessage: null,
  } as SearchHistory;

  function createService(opts: {
    adapters: Array<{
      siteCode: string;
      ADAPTER_VERSION: string;
      crawl: jest.Mock;
    }>;
    attemptSave?: jest.Mock;
  }) {
    const attempts: unknown[] = [];
    const attemptRepo = {
      create: jest.fn((data: unknown) => data),
      save:
        opts.attemptSave ??
        jest.fn(async (data: unknown) => {
          attempts.push(data);
          return data;
        }),
    };

    const searchHistoryRepo = {
      findOneByOrFail: jest.fn(async () => history),
      save: jest.fn(async (entity: SearchHistory) => entity),
    };

    const historyResultRepo = {
      count: jest.fn(async () => 0),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const adapters = {
      getAll: jest.fn(() => opts.adapters),
    };

    const service = new CrawlerService(
      adapters as never,
      { indexResult: jest.fn() } as never,
      { downloadAndStore: jest.fn() } as never,
      { publish: jest.fn(async () => undefined) } as never,
      { autoCreateFromSearch: jest.fn(async () => undefined) } as never,
      searchHistoryRepo as never,
      { findOne: jest.fn(), create: jest.fn(), save: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      { create: jest.fn(), save: jest.fn() } as never,
      historyResultRepo as never,
      attemptRepo as never,
    );

    return { service, attemptRepo, attempts, searchHistoryRepo };
  }

  beforeEach(() => {
    history.status = SearchStatus.QUEUED;
    history.startedAt = null;
    history.finishedAt = null;
    history.resultCount = 0;
    history.errorMessage = null;
  });

  it('records one attempt row per site on success and failure', async () => {
    const { service, attempts } = createService({
      adapters: [
        {
          siteCode: 'bungae',
          ADAPTER_VERSION: '1',
          crawl: jest.fn(async () => [
            {
              title: '카메라',
              price: 1000,
              seller: null,
              region: null,
              url: 'https://example.com/1',
              imageUrl: null,
              description: null,
              listedAt: null,
            },
          ]),
        },
        {
          siteCode: 'karrot',
          ADAPTER_VERSION: '1',
          crawl: jest.fn(async () => {
            throw new CrawlAdapterError({
              message: '[karrot] HTTP 403 for https://x',
              errorCode: 'HTTP_403',
              responseStatus: 403,
            });
          }),
        },
      ],
    });

    jest
      .spyOn(service as never, 'upsertResult' as never)
      .mockResolvedValue(true as never);

    const result = await service.executeCrawl({
      searchHistoryId: history.id,
      keyword: '카메라',
    });

    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({
      searchHistoryId: 'hist-1',
      siteCode: 'bungae',
      success: true,
      resultCount: 1,
      adapterVersion: '1',
      errorCode: null,
      responseStatus: null,
    });
    expect(attempts[1]).toMatchObject({
      searchHistoryId: 'hist-1',
      siteCode: 'karrot',
      success: false,
      resultCount: 0,
      adapterVersion: '1',
      errorCode: 'HTTP_403',
      responseStatus: 403,
    });
    expect(result.errors).toHaveLength(1);
    expect(history.status).toBe(SearchStatus.PARTIAL);
  });

  it('does not fail crawl when attempt recording throws', async () => {
    const { service } = createService({
      adapters: [
        {
          siteCode: 'bungae',
          ADAPTER_VERSION: '1',
          crawl: jest.fn(async () => []),
        },
      ],
      attemptSave: jest.fn(async () => {
        throw new Error('db unavailable');
      }),
    });

    const result = await service.executeCrawl({
      searchHistoryId: history.id,
      keyword: '빈결과',
    });

    expect(result.errors).toEqual([]);
    expect(history.status).toBe(SearchStatus.COMPLETED);
  });

  it('marks PARSE_EMPTY when crawl returns no listings', async () => {
    const { service, attempts } = createService({
      adapters: [
        {
          siteCode: 'joonggonara',
          ADAPTER_VERSION: '1',
          crawl: jest.fn(async () => []),
        },
      ],
    });

    await service.executeCrawl({
      searchHistoryId: history.id,
      keyword: '없음',
    });

    expect(attempts[0]).toMatchObject({
      siteCode: 'joonggonara',
      success: true,
      resultCount: 0,
      errorCode: 'PARSE_EMPTY',
    });
  });
});
