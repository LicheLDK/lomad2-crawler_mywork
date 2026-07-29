import { PinoLogger } from 'nestjs-pino';
import { TypeOrmPinoLogger } from './typeorm-pino.logger';

describe('TypeOrmPinoLogger', () => {
  const debug = jest.fn();
  const info = jest.fn();
  const warn = jest.fn();
  const error = jest.fn();
  const setContext = jest.fn();

  const pino = {
    debug,
    info,
    warn,
    error,
    setContext,
  } as unknown as PinoLogger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs queries as structured debug events', () => {
    const logger = new TypeOrmPinoLogger(pino);
    expect(setContext).toHaveBeenCalledWith('TypeORM');

    logger.logQuery('SELECT 1', [1]);
    expect(debug).toHaveBeenCalledWith(
      { type: 'query', query: 'SELECT 1', parameters: [1] },
      'query',
    );
  });

  it('logs slow queries as warn', () => {
    const logger = new TypeOrmPinoLogger(pino);
    logger.logQuerySlow(1500, 'SELECT 1', []);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'query-slow', timeMs: 1500 }),
      'slow query',
    );
  });

  it('logs query errors', () => {
    const logger = new TypeOrmPinoLogger(pino);
    logger.logQueryError(new Error('boom'), 'SELECT 1');
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'query-error',
        query: 'SELECT 1',
        error: 'boom',
      }),
      'query failed',
    );
  });
});
