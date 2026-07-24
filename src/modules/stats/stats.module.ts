import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { QueueModule } from '@/queue/queue.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
