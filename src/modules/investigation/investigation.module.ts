import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrawlerResult } from '@/database/entities/crawler-result.entity';
import { InvestigationCaseEntity } from '@/database/entities/investigation-case.entity';
import { SearchHistory } from '@/database/entities/search-history.entity';
import { SearchHistoryResult } from '@/database/entities/search-history-result.entity';
import { SearchJob } from '@/database/entities/search-job.entity';
import { AiModule } from '@/ai/ai.module';
import { InvestigationService } from './investigation.service';
import { InvestigationController } from './investigation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvestigationCaseEntity,
      SearchHistoryResult,
      SearchHistory,
      SearchJob,
      CrawlerResult,
    ]),
    AiModule,
  ],
  controllers: [InvestigationController],
  providers: [InvestigationService],
  exports: [InvestigationService],
})
export class InvestigationModule {}
