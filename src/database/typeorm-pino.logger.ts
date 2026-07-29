import { Logger as TypeOrmLogger, type QueryRunner } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';

/**
 * TypeORM → nestjs-pino 브릿지.
 * 쿼리/에러/슬로우가 터미널·파일 JSON 로그(logs/{api|worker}/)로 함께 기록된다.
 */
export class TypeOrmPinoLogger implements TypeOrmLogger {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('TypeORM');
  }

  logQuery(query: string, parameters?: unknown[], _queryRunner?: QueryRunner) {
    this.logger.debug(
      { type: 'query', query, parameters: parameters ?? undefined },
      'query',
    );
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ) {
    this.logger.error(
      {
        type: 'query-error',
        query,
        parameters: parameters ?? undefined,
        err: error instanceof Error ? error : undefined,
        error: error instanceof Error ? error.message : String(error),
      },
      'query failed',
    );
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ) {
    this.logger.warn(
      {
        type: 'query-slow',
        timeMs: time,
        query,
        parameters: parameters ?? undefined,
      },
      'slow query',
    );
  }

  logSchemaBuild(message: string, _queryRunner?: QueryRunner) {
    this.logger.info({ type: 'schema-build', message }, 'schema build');
  }

  logMigration(message: string, _queryRunner?: QueryRunner) {
    this.logger.info({ type: 'migration', message }, 'migration');
  }

  log(
    level: 'log' | 'info' | 'warn',
    message: unknown,
    _queryRunner?: QueryRunner,
  ) {
    const payload = { type: 'typeorm', message };
    if (level === 'warn') {
      this.logger.warn(payload, 'typeorm');
      return;
    }
    this.logger.info(payload, 'typeorm');
  }
}
