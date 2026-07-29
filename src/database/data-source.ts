import { join } from 'path';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import {
  AiPromptHistory,
  AiPromptVersion,
  AiRule,
  AiUsageLog,
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

loadEnv();

/**
 * TypeORM CLI / migration 전용 DataSource.
 * - 개발: npm run migration:run (ts-node → src)
 * - 운영/Docker: npm run migration:run:prod (dist)
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'crawler',
  password: process.env.DB_PASSWORD || 'crawler',
  database: process.env.DB_NAME || 'search_crawler',
  entities: [
    CrawlerSite,
    SearchKeyword,
    SearchHistory,
    SearchHistoryResult,
    CrawlerResult,
    ImageHash,
    SearchJob,
    SearchJobHistory,
    InvestigationCaseEntity,
    AiUsageLog,
    AiRule,
    AiPromptVersion,
    AiPromptHistory,
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
