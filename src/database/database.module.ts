import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  CrawlerResult,
  CrawlerSite,
  ImageHash,
  SearchHistory,
  SearchKeyword,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
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
          CrawlerResult,
          ImageHash,
        ],
        synchronize: config.get<string>('app.env') !== 'production',
        logging: config.get<string>('app.env') === 'development',
        // Windows ENOBUFS 완화: 연결 수/생성 속도 제한
        retryAttempts: 5,
        retryDelay: 2000,
        extra: {
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          keepAlive: true,
        },
      }),
    }),
    TypeOrmModule.forFeature([
      CrawlerSite,
      SearchKeyword,
      SearchHistory,
      CrawlerResult,
      ImageHash,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
