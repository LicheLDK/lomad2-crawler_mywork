/**
 * Worker 전용 엔트리포인트
 * API와 동일 AppModule을 로드하여 BullMQ Processor가 동작한다.
 * 운영에서는 crawler-api / crawler-worker 컨테이너를 분리한다.
 */
import dns from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { assertProductionSecrets } from './config/validate-production-secrets';

dns.setDefaultResultOrder('ipv4first');
assertProductionSecrets();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // eslint-disable-next-line no-console
  console.log('Crawl worker started (BullMQ processor active)');
}

bootstrap();
