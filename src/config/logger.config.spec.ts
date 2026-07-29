import { resolveLogApp, buildPinoHttpOptions } from './logger.config';

describe('logger.config', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('resolves LOG_APP over ENABLE_WORKER', () => {
    process.env.LOG_APP = 'api';
    process.env.ENABLE_WORKER = 'true';
    expect(resolveLogApp()).toBe('api');
  });

  it('falls back to worker when ENABLE_WORKER=true', () => {
    delete process.env.LOG_APP;
    process.env.ENABLE_WORKER = 'true';
    expect(resolveLogApp()).toBe('worker');
  });

  it('builds file + stdout JSON targets', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_APP = 'api';
    process.env.LOG_FILE = 'true';
    process.env.LOG_PRETTY = 'true';
    const opts = buildPinoHttpOptions();
    const targets = (
      opts.transport as { targets: { target: string; options?: { compact?: boolean } }[] }
    ).targets;
    expect(targets.length).toBe(2);
    expect(targets.some((t) => t.target.includes('pino-json-file-transport'))).toBe(
      true,
    );
    const stdout = targets.find((t) =>
      t.target.includes('pino-json-stdout-transport'),
    );
    expect(stdout).toBeDefined();
    expect(stdout?.options?.compact).toBe(false);
  });

  it('uses compact stdout when LOG_PRETTY=false', () => {
    process.env.LOG_APP = 'api';
    process.env.LOG_FILE = 'false';
    process.env.LOG_PRETTY = 'false';
    const opts = buildPinoHttpOptions();
    const targets = (
      opts.transport as { targets: { target: string; options?: { compact?: boolean } }[] }
    ).targets;
    expect(targets).toHaveLength(1);
    expect(targets[0]?.options?.compact).toBe(true);
  });
});
