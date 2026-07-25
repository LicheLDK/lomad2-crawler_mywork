import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import elasticConfig from './elastic.config';
import crawlerConfig from './crawler.config';
import rentalConfig from './rental.config';
import investigationConfig from './investigation.config';
import aiConfig from '@/ai/ai.config';

export const configs = [
  appConfig,
  databaseConfig,
  redisConfig,
  elasticConfig,
  crawlerConfig,
  rentalConfig,
  investigationConfig,
  aiConfig,
];
