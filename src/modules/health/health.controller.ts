import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { ElasticService } from '@/elastic/elastic.service';
import { CacheService } from '@/modules/cache/cache.service';
import { CrawlQueueService } from '@/queue/crawl-queue.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly elastic: ElasticService,
    private readonly cache: CacheService,
    private readonly crawlQueue: CrawlQueueService,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    const [elasticOk, redisOk, queueCounts] = await Promise.all([
      this.elastic.ping(),
      this.cache.ping(),
      this.crawlQueue.getJobCounts().catch(() => null),
    ]);

    const result = await this.health.check([
      () => this.db.pingCheck('postgres'),
    ]);

    return {
      ...result,
      info: {
        ...result.info,
        elasticsearch: { status: elasticOk ? 'up' : 'down' },
        redis: { status: redisOk ? 'up' : 'down' },
        queue: queueCounts,
      },
    };
  }
}
