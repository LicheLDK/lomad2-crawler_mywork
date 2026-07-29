import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;
  private readonly ttl: number;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      password: this.config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: null,
    });
    this.ttl = this.config.get<number>('crawler.searchCacheTtlSeconds') || 3600;
  }

  async setSearchJob(searchId: string, jobId: string): Promise<void> {
    await this.redis.set(`search:job:${searchId}`, jobId, 'EX', this.ttl);
  }

  async getSearchJob(searchId: string): Promise<string | null> {
    return this.redis.get(`search:job:${searchId}`);
  }

  async deleteSearchJob(searchId: string): Promise<void> {
    await this.redis.del(`search:job:${searchId}`);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = next;
      if (keys.length) {
        deleted += await this.redis.del(...keys);
      }
    } while (cursor !== '0');
    this.logger.log(`Deleted ${deleted} keys for pattern ${pattern}`);
    return deleted;
  }

  async flushSearchCache(): Promise<{ deleted: number }> {
    const deleted = await this.deleteByPattern('search:*');
    return { deleted };
  }

  async ping(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
