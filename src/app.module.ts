import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { configs } from './config';
import { DatabaseModule } from './database/database.module';
import { SiteSeedService } from './database/site-seed.service';
import { SearchModule } from './modules/search/search.module';
import { CrawlModule } from './modules/crawl/crawl.module';
import { CacheModule } from './modules/cache/cache.module';
import { HealthModule } from './modules/health/health.module';
import { StatsModule } from './modules/stats/stats.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { ProgressModule } from './progress/progress.module';
import { RentalModule } from './api/rental.module';
import { SearchJobModule } from './modules/search-job/search-job.module';
import { InvestigationModule } from './modules/investigation/investigation.module';
import { AiModule } from './ai/ai.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
      envFilePath: ['.env', '.env.local'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        quietReqLogger: true,
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.RATE_LIMIT_LIMIT || '100', 10),
      },
    ]),
    DatabaseModule,
    QueueModule,
    SearchModule,
    CrawlModule,
    CacheModule,
    HealthModule,
    StatsModule,
    StorageModule,
    ProgressModule,
    RentalModule,
    SearchJobModule,
    InvestigationModule,
    AiModule,
  ],
  providers: [
    SiteSeedService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
