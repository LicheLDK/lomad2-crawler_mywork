import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { ElasticModule } from '@/elastic/elastic.module';
import { QueueModule } from '@/queue/queue.module';
import { CacheModule } from '@/modules/cache/cache.module';
import { StorageModule } from '@/storage/storage.module';
import { ProgressModule } from '@/progress/progress.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    DatabaseModule,
    ElasticModule,
    QueueModule,
    CacheModule,
    StorageModule,
    ProgressModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
