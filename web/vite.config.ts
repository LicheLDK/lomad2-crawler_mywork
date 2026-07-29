import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Logger, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const WEB_LOG_DIR = path.resolve(__dirname, '../logs/web');
const WEB_LOG_FILE = path.join(WEB_LOG_DIR, 'web.log');
const MAX_WEB_LOG_BYTES = 20 * 1024 * 1024;

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function rotateWebLogIfNeeded() {
  try {
    if (!fs.existsSync(WEB_LOG_FILE)) return;
    const size = fs.statSync(WEB_LOG_FILE).size;
    if (size < MAX_WEB_LOG_BYTES) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const archive = path.join(WEB_LOG_DIR, `web.${stamp}.${Date.now()}.log`);
    fs.renameSync(WEB_LOG_FILE, archive);
  } catch {
    // ignore rotation errors
  }
}

function appendWebLog(level: string, message: string) {
  try {
    fs.mkdirSync(WEB_LOG_DIR, { recursive: true });
    rotateWebLogIfNeeded();
    const entry = {
      level,
      time: new Date().toISOString(),
      app: 'web',
      msg: stripAnsi(String(message)),
    };
    fs.appendFileSync(
      WEB_LOG_FILE,
      `${JSON.stringify(entry, null, 2)}\n\n`,
      'utf8',
    );
  } catch {
    // ignore file log failures
  }
}

function wrapLogger(logger: Logger): Logger {
  const methods = ['info', 'warn', 'error'] as const;
  for (const method of methods) {
    const original = logger[method].bind(logger);
    logger[method] = (msg, options) => {
      appendWebLog(method, typeof msg === 'string' ? msg : String(msg));
      original(msg, options);
    };
  }
  return logger;
}

function webFileLogPlugin(): Plugin {
  return {
    name: 'lomad-web-file-log',
    configResolved(config) {
      wrapLogger(config.logger);
    },
  };
}

export default defineConfig({
  plugins: [react(), webFileLogPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
      },
    },
  },
});
