import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ElasticModule } from '@/elastic/elastic.module';
import { CacheModule } from '@/modules/cache/cache.module';
import { QueueModule } from '@/queue/queue.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, ElasticModule, CacheModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}
