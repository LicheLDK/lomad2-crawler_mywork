import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { QueueModule } from '@/queue/queue.module';
import { CrawlerModule } from '@/crawler/crawler.module';
import { ProgressModule } from '@/progress/progress.module';
import { CrawlController } from './crawl.controller';
import { CrawlService } from './crawl.service';

@Module({
  imports: [DatabaseModule, QueueModule, CrawlerModule, ProgressModule],
  controllers: [CrawlController],
  providers: [CrawlService],
})
export class CrawlModule {}
