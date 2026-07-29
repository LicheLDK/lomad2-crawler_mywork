import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchJob } from '@/database/entities/search-job.entity';
import { SearchJobHistory } from '@/database/entities/search-job-history.entity';
import { SearchModule } from '@/modules/search/search.module';
import { InvestigationModule } from '@/modules/investigation/investigation.module';
import { RentalModule } from '@/api/rental.module';
import { AiModule } from '@/ai/ai.module';
import { SearchJobController } from './search-job.controller';
import { SearchJobService } from './search-job.service';
import { SearchJobProgressSync } from './search-job-progress.sync';
import { SearchKeywordGeneratorService } from './search-keyword-generator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchJob, SearchJobHistory]),
    SearchModule,
    InvestigationModule,
    RentalModule,
    AiModule,
  ],
  controllers: [SearchJobController],
  providers: [
    SearchJobService,
    SearchJobProgressSync,
    SearchKeywordGeneratorService,
  ],
  exports: [
    SearchJobService,
    SearchJobProgressSync,
    SearchKeywordGeneratorService,
  ],
})
export class SearchJobModule {}
