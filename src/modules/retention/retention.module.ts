import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLog, CrawlSiteAttempt } from '@/database/entities';
import { RetentionCleanupService } from './retention-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrawlSiteAttempt, AiUsageLog])],
  providers: [RetentionCleanupService],
  exports: [RetentionCleanupService],
})
export class RetentionModule {}
