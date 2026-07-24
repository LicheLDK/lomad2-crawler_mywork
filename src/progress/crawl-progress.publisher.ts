import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  CRAWL_PROGRESS_CHANNEL,
  CrawlProgressEvent,
} from './crawl-progress.types';

@Injectable()
export class CrawlProgressPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(CrawlProgressPublisher.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      password: config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }

  async publish(event: CrawlProgressEvent): Promise<void> {
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect();
      }
      await this.redis.publish(
        CRAWL_PROGRESS_CHANNEL,
        JSON.stringify(event),
      );
    } catch (error) {
      this.logger.warn(
        `Progress publish failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
