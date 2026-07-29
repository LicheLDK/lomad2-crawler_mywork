import { StatsService } from './stats.service';

describe('StatsService siteMetrics (TASK B-4)', () => {
  function createService(opts?: {
    siteMetricsRows?: Array<{
      siteCode: string;
      totalAttempts: string;
      successCount: string;
      failCount: string;
      avgLatencyMs: string | null;
      p95LatencyMs: string | null;
    }>;
  }) {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(opts?.siteMetricsRows ?? []),
    };

    const attemptRepo = {
      createQueryBuilder: jest.fn(() => qb),
    };

    const resultRepo = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const historyRepo = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const keywordRepo = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
    };

    const crawlQueue = {
      getJobCounts: jest.fn().mockResolvedValue({}),
    };

    const service = new StatsService(
      resultRepo as never,
      historyRepo as never,
      keywordRepo as never,
      attemptRepo as never,
      crawlQueue as never,
    );

    return { service, attemptRepo, qb };
  }

  it('returns empty siteMetrics when no attempts exist', async () => {
    const { service } = createService();

    const overview = await service.getOverview(24);

    expect(overview.siteMetrics).toEqual({ hours: 24, sites: [] });
  });

  it('aggregates success rate and latency per site', async () => {
    const { service } = createService({
      siteMetricsRows: [
        {
          siteCode: 'joonggonara',
          totalAttempts: '10',
          successCount: '8',
          failCount: '2',
          avgLatencyMs: '150.6',
          p95LatencyMs: '420.2',
        },
        {
          siteCode: 'bungae',
          totalAttempts: '4',
          successCount: '1',
          failCount: '3',
          avgLatencyMs: '200',
          p95LatencyMs: '350',
        },
      ],
    });

    const overview = await service.getOverview(24);

    expect(overview.siteMetrics.hours).toBe(24);
    expect(overview.siteMetrics.sites).toEqual([
      {
        siteCode: 'joonggonara',
        totalAttempts: 10,
        successCount: 8,
        failCount: 2,
        successRate: 0.8,
        avgLatencyMs: 151,
        p95LatencyMs: 420,
      },
      {
        siteCode: 'bungae',
        totalAttempts: 4,
        successCount: 1,
        failCount: 3,
        successRate: 0.25,
        avgLatencyMs: 200,
        p95LatencyMs: 350,
      },
    ]);
  });
});
