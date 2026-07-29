import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule, PinoLogger } from 'nestjs-pino';
import {
  AiPromptHistory,
  AiPromptVersion,
  AiRule,
  AiUsageLog,
  CrawlSiteAttempt,
  CrawlerResult,
  CrawlerSite,
  ImageHash,
  InvestigationCaseEntity,
  SearchHistory,
  SearchHistoryResult,
  SearchJob,
  SearchJobHistory,
  SearchKeyword,
} from './entities';
import { TypeOrmPinoLogger } from './typeorm-pino.logger';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  const v = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, LoggerModule],
      inject: [ConfigService, PinoLogger],
      useFactory: (config: ConfigService, pino: PinoLogger) => {
        const env = config.get<string>('app.env') || 'development';
        const isProd = env === 'production';
        const loggingEnabled = parseBool(process.env.TYPEORM_LOGGING, !isProd);
        const slowMs = parseInt(process.env.TYPEORM_SLOW_MS || '1000', 10);

        return {
          type: 'postgres' as const,
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.database'),
          entities: [
            CrawlerSite,
            SearchKeyword,
            SearchHistory,
            SearchHistoryResult,
            CrawlerResult,
            ImageHash,
            SearchJob,
            SearchJobHistory,
            CrawlSiteAttempt,
            InvestigationCaseEntity,
            AiUsageLog,
            AiRule,
            AiPromptVersion,
            AiPromptHistory,
          ],
          synchronize: !isProd,
          logging: loggingEnabled,
          logger: new TypeOrmPinoLogger(pino),
          maxQueryExecutionTime: Number.isFinite(slowMs) ? slowMs : 1000,
          // Windows ENOBUFS 완화: 연결 수/생성 속도 제한
          retryAttempts: 5,
          retryDelay: 2000,
          extra: {
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            keepAlive: true,
          },
        };
      },
    }),
    TypeOrmModule.forFeature([
      CrawlerSite,
      SearchKeyword,
      SearchHistory,
      SearchHistoryResult,
      CrawlerResult,
      ImageHash,
      SearchJob,
      SearchJobHistory,
      CrawlSiteAttempt,
      InvestigationCaseEntity,
      AiUsageLog,
      AiRule,
      AiPromptVersion,
      AiPromptHistory,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
