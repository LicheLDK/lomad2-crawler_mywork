import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import {
  CrawlerResult,
  CrawlerSite,
  ImageHash,
  SearchHistory,
  SearchKeyword,
} from './entities';

loadEnv();

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
    CrawlerResult,
    ImageHash,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
