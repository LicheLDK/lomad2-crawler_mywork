import { registerAs } from '@nestjs/config';

export default registerAs('retention', () => ({
  enabled: (process.env.METRICS_RETENTION_ENABLED ?? 'true') === 'true',
  crawlAttemptsDays: parseInt(
    process.env.METRICS_RETENTION_CRAWL_ATTEMPTS_DAYS || '90',
    10,
  ),
  aiUsageDays: parseInt(
    process.env.METRICS_RETENTION_AI_USAGE_DAYS || '180',
    10,
  ),
  batchSize: parseInt(process.env.METRICS_RETENTION_BATCH_SIZE || '1000', 10),
}));
