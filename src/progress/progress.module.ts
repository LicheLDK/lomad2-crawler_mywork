import { Module } from '@nestjs/common';
import { CrawlProgressPublisher } from './crawl-progress.publisher';
import { CrawlProgressGateway } from './crawl-progress.gateway';

/** API 프로세스에서만 WebSocket Gateway 기동 (워커는 Publisher만) */
const enableWorker = (process.env.ENABLE_WORKER || 'true') === 'true';

@Module({
  providers: [
    CrawlProgressPublisher,
    ...(!enableWorker ? [CrawlProgressGateway] : []),
  ],
  exports: [CrawlProgressPublisher],
})
export class ProgressModule {}
