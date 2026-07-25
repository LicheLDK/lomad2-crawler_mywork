import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestigationCaseEntity } from '@/database/entities/investigation-case.entity';
import { CrawlerResult } from '@/database/entities/crawler-result.entity';
import { SearchHistory } from '@/database/entities/search-history.entity';
import { SearchJob } from '@/database/entities/search-job.entity';
import { AiModule } from '@/ai/ai.module';
import { InvestigationService } from './investigation.service';
import { InvestigationController } from './investigation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvestigationCaseEntity,
      CrawlerResult,
      SearchHistory,
      SearchJob,
    ]),
    AiModule,
  ],
  controllers: [InvestigationController],
  providers: [InvestigationService],
  exports: [InvestigationService],
})
export class InvestigationModule {}
