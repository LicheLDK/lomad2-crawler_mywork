import { InvestigationService } from './investigation.service';
import { InvestigationCaseEntity } from '@/database/entities/investigation-case.entity';

describe('InvestigationService autoCreateFromSearch', () => {
  type SearchResultInput = {
    id: string;
    title: string;
    siteCode: string;
    url: string;
    imageUrl?: string | null;
    price?: string | number | null;
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
  };

  function createService() {
    const cases: InvestigationCaseEntity[] = [];
    const history = {
      id: 'history-1',
      keyword: '테스트 상품',
    };
    const jobs = new Map<string, { id: string; orderNo?: string | null }>([
      ['job-1', { id: 'job-1', orderNo: 'ORDER-1' }],
    ]);

    const caseRepo = {
      findOne: jest.fn(
        async ({
          where,
        }: {
          where: Partial<InvestigationCaseEntity>;
        }) => {
          if (where.resultId) {
            return cases.find((item) => item.resultId === where.resultId) ?? null;
          }
          if (where.id) {
            return cases.find((item) => item.id === where.id) ?? null;
          }
          return null;
        },
      ),
      create: jest.fn((data: Partial<InvestigationCaseEntity>) => ({
        ...data,
      })),
      save: jest.fn(async (entity: Partial<InvestigationCaseEntity>) => {
        const normalized = {
          id: entity.id ?? `case-${cases.length + 1}`,
          caseNo: entity.caseNo ?? `CASE-20260728-${String(cases.length + 1).padStart(6, '0')}`,
          productName: entity.productName ?? '',
          aiScore: entity.aiScore ?? 0,
          status: entity.status ?? 'Open',
          priority: entity.priority ?? 'Medium',
          assignee: entity.assignee ?? null,
          siteCode: entity.siteCode ?? 'bungae',
          url: entity.url ?? null,
          imageUrl: entity.imageUrl ?? null,
          price: entity.price ?? null,
          resultId: entity.resultId ?? null,
          searchHistoryId: entity.searchHistoryId ?? null,
          searchJobId: entity.searchJobId ?? null,
          orderNo: entity.orderNo ?? null,
          contractNo: entity.contractNo ?? null,
          customerName: entity.customerName ?? null,
          orderProductName: entity.orderProductName ?? null,
          listingTitle: entity.listingTitle ?? null,
          autoCreated: entity.autoCreated ?? true,
          timeline: entity.timeline ?? [],
          aiAnalysis: entity.aiAnalysis ?? null,
          notes: entity.notes ?? [],
          finalDecision: entity.finalDecision ?? null,
          finalDecisionNote: entity.finalDecisionNote ?? null,
          decidedAt: entity.decidedAt ?? null,
          dueDate: entity.dueDate ?? null,
          createdAt: entity.createdAt ?? new Date('2026-07-28T00:00:00.000Z'),
          updatedAt: new Date('2026-07-28T00:00:00.000Z'),
        } as InvestigationCaseEntity;

        const index = cases.findIndex((item) => item.id === normalized.id);
        if (index >= 0) {
          cases[index] = normalized;
        } else {
          cases.push(normalized);
        }
        return normalized;
      }),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => {
          const latest = [...cases]
            .sort((left, right) => right.caseNo.localeCompare(left.caseNo))[0];
          return latest ?? null;
        }),
      })),
      count: jest.fn(async () => cases.length),
      find: jest.fn(async () => [...cases]),
    };

    const historyRepo = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === history.id ? history : null,
      ),
    };

    const jobRepo = {
      findOne: jest.fn(
        async ({
          where,
        }: {
          where: { id?: string; searchHistoryId?: string };
        }) => {
          if (where.id) {
            return jobs.get(where.id) ?? null;
          }
          return null;
        },
      ),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'investigation.autoCreateEnabled') return true;
        if (key === 'investigation.aiScoreThreshold') return 90;
        if (key === 'investigation.orderUrlTemplate')
          return '/getOrderInfo?order_id={orderNo}';
        return undefined;
      }),
    };

    const aiService = {
      canAnalyzeInvestigation: jest.fn(() => false),
    };

    const ruleEngine = {
      getCreateThreshold: jest.fn(() => 90),
      evaluate: jest.fn(async ({ aiScore }: { aiScore: number }) => ({
        exclude: aiScore < 50,
        createInvestigation: aiScore >= 90,
        warnings: [],
        matched: [],
      })),
    };

    const service = new InvestigationService(
      caseRepo as never,
      { find: jest.fn(), findOne: jest.fn() } as never,
      historyRepo as never,
      jobRepo as never,
      { findOne: jest.fn() } as never,
      config as never,
      aiService as never,
      ruleEngine as never,
    );

    return {
      service,
      cases,
      caseRepo,
    };
  }

  it('updates an existing Open case when AI matching arrives for the same result', async () => {
    const { service, cases } = createService();
    const heuristicResult: SearchResultInput = {
      id: 'listing-1',
      title: '테스트 상품 판매',
      siteCode: 'bungae',
      url: 'https://example.com/listing-1',
      titleSimilarity: 0.95,
      imageSimilarity: 0.1,
      price: '100000',
    };
    const aiResult: SearchResultInput = {
      ...heuristicResult,
      aiScore: 99,
      matchingScore: 99,
      matchingReason: 'AI가 동일 상품으로 판단',
      matchingScores: {
        brand: 100,
        model: 98,
        productName: 99,
        image: 97,
      },
    };

    await service.autoCreateFromSearch({
      searchHistoryId: 'history-1',
      results: [heuristicResult],
    });
    expect(cases).toHaveLength(1);
    expect(cases[0].aiScore).toBeCloseTo(0.95);

    const second = await service.autoCreateFromSearch({
      searchHistoryId: 'history-1',
      searchJobId: 'job-1',
      results: [aiResult],
    });

    expect(second.created).toHaveLength(0);
    expect(second.updated).toHaveLength(1);
    expect(second.skipped).toBe(0);
    expect(cases).toHaveLength(1);
    expect(cases[0].aiScore).toBeCloseTo(0.99);
    expect(cases[0].priority).toBe('High');
    expect(cases[0].searchJobId).toBe('job-1');
    expect(cases[0].orderNo).toBe('ORDER-1');
    expect(
      cases[0].timeline.some((event) => event.title === 'AI 매칭 점수로 갱신'),
    ).toBe(true);
  });

  it('does not overwrite a case once a human changed the status away from Open', async () => {
    const { service, cases } = createService();
    const heuristicResult: SearchResultInput = {
      id: 'listing-2',
      title: '수동 검토 대상',
      siteCode: 'bungae',
      url: 'https://example.com/listing-2',
      titleSimilarity: 0.93,
      imageSimilarity: 0.2,
      price: '200000',
    };
    const aiResult: SearchResultInput = {
      ...heuristicResult,
      aiScore: 98,
      matchingScore: 98,
      matchingReason: 'AI가 같은 상품으로 재판단',
      matchingScores: {
        brand: 100,
        model: 96,
        productName: 99,
        image: 95,
      },
    };

    await service.autoCreateFromSearch({
      searchHistoryId: 'history-1',
      results: [heuristicResult],
    });
    expect(cases).toHaveLength(1);

    cases[0].status = 'Review';

    const second = await service.autoCreateFromSearch({
      searchHistoryId: 'history-1',
      searchJobId: 'job-1',
      results: [aiResult],
    });

    expect(second.created).toHaveLength(0);
    expect(second.updated).toHaveLength(0);
    expect(second.skipped).toBe(1);
    expect(cases[0].status).toBe('Review');
    expect(cases[0].aiScore).toBeCloseTo(0.93);
    expect(
      cases[0].timeline.some((event) => event.title === 'AI 매칭 점수로 갱신'),
    ).toBe(false);
  });

  it('keeps the case and records an exclude recommendation when AI score falls below the exclude rule', async () => {
    const { service, cases } = createService();
    const heuristicResult: SearchResultInput = {
      id: 'listing-3',
      title: '초기 휴리스틱 고득점 케이스',
      siteCode: 'bungae',
      url: 'https://example.com/listing-3',
      titleSimilarity: 0.94,
      imageSimilarity: 0.2,
      price: '300000',
    };
    const aiResult: SearchResultInput = {
      ...heuristicResult,
      aiScore: 40,
      matchingScore: 40,
      matchingReason: 'AI가 다른 상품으로 판단',
      matchingScores: {
        brand: 20,
        model: 10,
        productName: 35,
        image: 15,
      },
    };

    await service.autoCreateFromSearch({
      searchHistoryId: 'history-1',
      results: [heuristicResult],
    });
    expect(cases).toHaveLength(1);
    expect(cases[0].aiScore).toBeCloseTo(0.94);

    const second = await service.autoCreateFromSearch({
      searchHistoryId: 'history-1',
      searchJobId: 'job-1',
      results: [aiResult],
    });

    expect(second.created).toHaveLength(0);
    expect(second.updated).toHaveLength(0);
    expect(second.excluded).toBe(1);
    expect(second.skipped).toBe(1);
    expect(cases).toHaveLength(1);
    expect(cases[0].aiScore).toBeCloseTo(0.94);
    expect(cases[0].status).toBe('Open');
    expect(
      cases[0].timeline.some(
        (event) => event.title === 'AI 재평가 결과 제외 권고',
      ),
    ).toBe(true);
  });

  it('does not create a new case when AI exclude fires and no case exists yet', async () => {
    const { service, cases } = createService();
    const aiOnlyLowScoreResult: SearchResultInput = {
      id: 'listing-4',
      title: 'AI 제외 대상',
      siteCode: 'bungae',
      url: 'https://example.com/listing-4',
      aiScore: 35,
      matchingScore: 35,
      matchingReason: 'AI가 무관한 상품으로 판단',
      matchingScores: {
        brand: 10,
        model: 5,
        productName: 30,
        image: 20,
      },
      price: '50000',
    };

    const result = await service.autoCreateFromSearch({
      searchHistoryId: 'history-1',
      searchJobId: 'job-1',
      results: [aiOnlyLowScoreResult],
    });

    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
    expect(result.excluded).toBe(1);
    expect(result.skipped).toBe(1);
    expect(cases).toHaveLength(0);
  });
});
