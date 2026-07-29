/**
 * 메트릭 retention 정리 CLI (TASK B-8).
 * 운영 cron 예: 0 3 * * * cd /app && npm run retention:cleanup:prod
 */
import dns from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { assertProductionSecrets } from './config/validate-production-secrets';
import { RetentionCleanupService } from './modules/retention/retention-cleanup.service';

dns.setDefaultResultOrder('ipv4first');
assertProductionSecrets();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const service = app.get(RetentionCleanupService);
  const result = await service.runCleanup();

  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
