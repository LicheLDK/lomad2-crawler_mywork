import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  crawlQueueName: process.env.CRAWL_QUEUE_NAME || 'crawl-queue',
  concurrency: parseInt(process.env.CRAWL_CONCURRENCY || '5', 10),
  attempts: parseInt(process.env.CRAWL_ATTEMPTS || '3', 10),
  backoffMs: parseInt(process.env.CRAWL_BACKOFF_MS || '5000', 10),
}));
