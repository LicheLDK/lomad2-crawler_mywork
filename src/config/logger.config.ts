import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type LogApp = 'api' | 'worker' | 'web';

export function resolveLogApp(): LogApp {
  const raw = (process.env.LOG_APP || '').trim().toLowerCase();
  if (raw === 'api' || raw === 'worker' || raw === 'web') {
    return raw;
  }
  return process.env.ENABLE_WORKER === 'true' ? 'worker' : 'api';
}

export function resolveLogDir(app: LogApp = resolveLogApp()): string {
  const root = process.env.LOG_DIR?.trim() || join(process.cwd(), 'logs');
  return join(root, app);
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  const v = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

function resolveLevel(): string {
  return (
    process.env.LOG_LEVEL?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
  );
}

/**
 * 터미널 JSON 들여쓰기 (기본 on).
 * LOG_PRETTY=false 또는 LOG_COMPACT=true 이면 한 줄 NDJSON.
 */
function resolveStdoutCompact(): boolean {
  if (process.env.LOG_COMPACT != null && process.env.LOG_COMPACT !== '') {
    return parseBool(process.env.LOG_COMPACT, false);
  }
  if (process.env.LOG_PRETTY != null && process.env.LOG_PRETTY !== '') {
    // LOG_PRETTY=false → compact
    return !parseBool(process.env.LOG_PRETTY, true);
  }
  return false;
}

function resolveFileEnabled(): boolean {
  return parseBool(process.env.LOG_FILE, true);
}

type PinoTarget = {
  target: string;
  level?: string;
  options?: Record<string, unknown>;
};

/**
 * nestjs-pino / pino-http 옵션.
 * - 터미널: pretty JSON (들여쓰기) — 파일과 동일 포맷
 * - 파일: logs/{api|worker}/ 에 pretty JSON + pino-roll 로테이션
 */
export function buildPinoHttpOptions() {
  const app = resolveLogApp();
  const level = resolveLevel();
  const stdoutCompact = resolveStdoutCompact();
  const fileEnabled = resolveFileEnabled();
  const logDir = resolveLogDir(app);
  const targets: PinoTarget[] = [];

  if (fileEnabled) {
    targets.push({
      target: join(process.cwd(), 'logging', 'pino-json-file-transport.cjs'),
      level,
      options: {
        file: join(logDir, app),
        frequency: process.env.LOG_FREQUENCY?.trim() || 'daily',
        size: process.env.LOG_SIZE?.trim() || '20m',
        limit: parseInt(process.env.LOG_RETENTION || '14', 10),
        dateFormat: 'yyyy-MM-dd',
        mkdir: true,
      },
    });
  }

  targets.push({
    target: join(process.cwd(), 'logging', 'pino-json-stdout-transport.cjs'),
    level,
    options: {
      compact: stdoutCompact,
    },
  });

  return {
    name: app,
    level,
    transport: { targets },
    autoLogging: true,
    quietReqLogger: true,
    redact: {
      paths: [
        'req.headers["x-api-key"]',
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
      ],
      censor: '[Redacted]',
    },
    customProps: () => ({
      app,
    }),
    serializers: {
      req(req: IncomingMessage & {
        id?: unknown;
        query?: unknown;
        params?: unknown;
        remoteAddress?: string;
        remotePort?: number;
      }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          query: req.query,
          params: req.params,
          headers: req.headers,
          remoteAddress: req.remoteAddress,
          remotePort: req.remotePort,
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
          headers: res.getHeaders?.() ?? undefined,
        };
      },
    },
  };
}
