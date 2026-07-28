import { SearchJobStatus } from '@/database/entities/search-job.entity';
import { SearchJobService } from './search-job.service';

describe('SearchJobService', () => {
  function createService() {
    const jobRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
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
      searchService as never,
      progressSync as never,
      keywordGenerator as never,
      investigationService as never,
      rentalService as never,
      aiService as never,
    );

    jest
      .spyOn(service as any, 'runSearch')
      .mockResolvedValue(undefined as void);

    return {
      service,
      jobRepo,
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
});
