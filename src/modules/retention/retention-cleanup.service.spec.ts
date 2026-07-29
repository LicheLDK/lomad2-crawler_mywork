import { RetentionCleanupService } from './retention-cleanup.service';

describe('RetentionCleanupService (TASK B-8)', () => {
  function createService(opts?: {
    enabled?: boolean;
    crawlAttemptsDays?: number;
    aiUsageDays?: number;
    batchSize?: number;
    attemptDeletes?: number[];
    usageDeletes?: number[];
  }) {
    const attemptDeletes = [...(opts?.attemptDeletes ?? [0])];
    const usageDeletes = [...(opts?.usageDeletes ?? [0])];

    const attemptRepo = {
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockImplementation(async () => ({
          affected: attemptDeletes.shift() ?? 0,
        })),
      })),
    };

    const usageRepo = {
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockImplementation(async () => ({
          affected: usageDeletes.shift() ?? 0,
        })),
      })),
    };

    const config = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          'retention.enabled': opts?.enabled ?? true,
          'retention.crawlAttemptsDays': opts?.crawlAttemptsDays ?? 90,
          'retention.aiUsageDays': opts?.aiUsageDays ?? 180,
          'retention.batchSize': opts?.batchSize ?? 1000,
        };
        return map[key];
      }),
    };

    const service = new RetentionCleanupService(
      config as never,
      attemptRepo as never,
      usageRepo as never,
    );

    return { service, attemptRepo, usageRepo, config };
  }

  it('skips deletes when retention is disabled', async () => {
    const { service, attemptRepo, usageRepo } = createService({ enabled: false });

    const result = await service.runCleanup();

    expect(result.enabled).toBe(false);
    expect(result.crawlSiteAttemptsDeleted).toBe(0);
    expect(result.aiUsageLogsDeleted).toBe(0);
    expect(attemptRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(usageRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('deletes crawl attempts and ai usage logs in batches', async () => {
    const { service } = createService({
      attemptDeletes: [1000, 250, 0],
      usageDeletes: [500, 0],
    });

    const result = await service.runCleanup();

    expect(result.enabled).toBe(true);
    expect(result.crawlSiteAttemptsDeleted).toBe(1250);
    expect(result.aiUsageLogsDeleted).toBe(500);
    expect(result.crawlAttemptsRetentionDays).toBe(90);
    expect(result.aiUsageRetentionDays).toBe(180);
  });

  it('records last run time after cleanup', async () => {
    const { service } = createService();

    expect(service.getLastRunAt()).toBeNull();
    await service.runCleanup();
    expect(service.getLastRunAt()).toBeInstanceOf(Date);
  });
});
