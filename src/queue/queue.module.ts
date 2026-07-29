import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@/common/constants/queue';
import { CrawlerModule } from '@/crawler/crawler.module';
import { CrawlQueueService } from './crawl-queue.service';
import { CrawlProcessor } from './crawl.processor';
import { QueueController } from './queue.controller';

const enableWorker = (process.env.ENABLE_WORKER || 'true') === 'true';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
        },
      }),
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.CRAWL,
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.CRAWL_DLQ,
    }),
    CrawlerModule,
  ],
  controllers: [QueueController],
  providers: [
    CrawlQueueService,
    ...(enableWorker ? [CrawlProcessor] : []),
  ],
  exports: [CrawlQueueService, BullModule],
})
export class QueueModule {}
