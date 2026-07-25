import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { ElasticModule } from '@/elastic/elastic.module';
import { StorageModule } from '@/storage/storage.module';
import { ProgressModule } from '@/progress/progress.module';
import { InvestigationModule } from '@/modules/investigation/investigation.module';
import { JoonggonaraAdapter } from './adapter/joonggonara.adapter';
import { BungaeAdapter } from './adapter/bungae.adapter';
import { KarrotAdapter } from './adapter/karrot.adapter';
import { AdapterRegistry } from './adapter/adapter.registry';
import { CrawlerService } from './crawler.service';

@Module({
  imports: [
    DatabaseModule,
    ElasticModule,
    StorageModule,
    ProgressModule,
    InvestigationModule,
  ],
  providers: [
    JoonggonaraAdapter,
    BungaeAdapter,
    KarrotAdapter,
    AdapterRegistry,
    CrawlerService,
  ],
  exports: [CrawlerService, AdapterRegistry],
})
export class CrawlerModule {}
