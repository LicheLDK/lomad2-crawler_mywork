import { CrawlerService } from './crawler.service';
import { SearchHistory, SearchStatus } from '@/database/entities';

/**
 * 회귀: 동일 URL 재검색 시 listing 마스터는 1개, 검색 스냅샷은 이력별로 유지.
 */
describe('CrawlerService history snapshot (regression)', () => {
  const listingUrl = 'https://www.bunjang.co.kr/products/99';

  let resultEntity: {
    id: string;
    url: string;
    searchHistoryId: string | null;
    title: string;
    price: string | null;
    seller: string | null;
    region: string | null;
    imageUrl: string | null;
    description: string | null;
    titleSimilarity: number | null;
    imageSimilarity: number | null;
    imageHash: null;
    contentHash: string | null;
    createdAt: Date;
    siteCode: string;
  };

  const snapshots: Array<{
    searchHistoryId: string;
    resultId: string;
    title: string;
  }> = [];

  let service: CrawlerService;

  beforeEach(() => {
    snapshots.length = 0;
    resultEntity = {
      id: 'listing-1',
      url: listingUrl,
      searchHistoryId: null,
      title: '',
      price: null,
      seller: null,
      region: null,
      imageUrl: null,
      description: null,
      titleSimilarity: null,
      imageSimilarity: null,
      imageHash: null,
      contentHash: null,
      createdAt: new Date(),
      siteCode: 'bungae',
    };

    const resultRepo = {
      findOne: jest.fn(async ({ where }: { where: { url: string } }) =>
        resultEntity.url === where.url && resultEntity.title
          ? { ...resultEntity, imageHash: null }
          : null,
      ),
      create: jest.fn((data: typeof resultEntity) => ({ ...data })),
      save: jest.fn(async (entity: typeof resultEntity) => {
        Object.assign(resultEntity, entity, {
          id: resultEntity.id || 'listing-1',
          createdAt: resultEntity.createdAt || new Date(),
        });
        return { ...resultEntity };
      }),
      count: jest.fn(),
    };

    const historyResultRepo = {
      findOne: jest.fn(
        async ({
          where,
        }: {
          where: { searchHistoryId: string; resultId: string };
        }) =>
          snapshots.find(
            (s) =>
              s.searchHistoryId === where.searchHistoryId &&
              s.resultId === where.resultId,
          ) ?? null,
      ),
      create: jest.fn((data: (typeof snapshots)[number]) => data),
      save: jest.fn(async (data: (typeof snapshots)[number]) => {
        const idx = snapshots.findIndex(
          (s) =>
            s.searchHistoryId === data.searchHistoryId &&
            s.resultId === data.resultId,
        );
        if (idx >= 0) snapshots[idx] = data;
        else snapshots.push(data);
        return data;
      }),
      count: jest.fn(async ({ where }: { where: { searchHistoryId: string } }) =>
        snapshots.filter((s) => s.searchHistoryId === where.searchHistoryId)
          .length,
      ),
    };

    const elastic = {
      indexResult: jest.fn(async () => undefined),
    };

    service = new CrawlerService(
      {} as never,
      elastic as never,
      { downloadAndStore: jest.fn(async () => null) } as never,
      { publish: jest.fn(async () => undefined) } as never,
      { autoCreateFromSearch: jest.fn(async () => undefined) } as never,
      {} as never,
      resultRepo as never,
      { findOne: jest.fn(async () => ({ id: 'site-1' })) } as never,
      {} as never,
      historyResultRepo as never,
    );
  });

  it('검색 A·B가 같은 URL을 잡아도 스냅샷이 둘 다 남는다', async () => {
    const historyA = {
      id: 'history-a',
      status: SearchStatus.RUNNING,
    } as SearchHistory;
    const historyB = {
      id: 'history-b',
      status: SearchStatus.RUNNING,
    } as SearchHistory;

    const listing = {
      title: '원목 식탁',
      price: 100000,
      seller: 'seller',
      region: '서울',
      url: listingUrl,
      imageUrl: null,
      description: null,
      listedAt: null,
    };

    await (
      service as unknown as {
        upsertResult: (
          h: SearchHistory,
          site: string,
          item: typeof listing,
          payload: { keyword: string; searchHistoryId: string },
        ) => Promise<boolean>;
      }
    ).upsertResult(historyA, 'bungae', listing, {
      keyword: '식탁',
      searchHistoryId: historyA.id,
    });

    await (
      service as unknown as {
        upsertResult: (
          h: SearchHistory,
          site: string,
          item: typeof listing,
          payload: { keyword: string; searchHistoryId: string },
        ) => Promise<boolean>;
      }
    ).upsertResult(
      historyB,
      'bungae',
      { ...listing, title: '원목 식탁 상태좋음', price: 90000 },
      {
        keyword: '원목식탁',
        searchHistoryId: historyB.id,
      },
    );

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((s) => s.searchHistoryId).sort()).toEqual([
      'history-a',
      'history-b',
    ]);
    expect(snapshots.find((s) => s.searchHistoryId === 'history-a')?.title).toBe(
      '원목 식탁',
    );
    expect(snapshots.find((s) => s.searchHistoryId === 'history-b')?.title).toBe(
      '원목 식탁 상태좋음',
    );
    // listing 마스터는 1개, last-seen 만 B
    expect(resultEntity.id).toBe('listing-1');
    expect(resultEntity.searchHistoryId).toBe('history-b');
  });
});
