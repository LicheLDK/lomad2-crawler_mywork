/**
 * PM2 ecosystem — Search Crawler (API + Worker + Web)
 *
 * 준비:
 *   npm run infra:up
 *   npm run build:all
 *   mkdir logs   (Windows: New-Item -ItemType Directory -Force logs)
 *
 * 기동:
 *   npm run pm2:start
 *   pm2 status
 *   pm2 logs
 *
 * 재시작:
 *   npm run build:all
 *   npm run pm2:reload
 *
 * 종료:
 *   npm run pm2:stop
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'crawler-api',
      cwd: __dirname,
      script: 'dist/main.js',
      node_args: '-r ./dist/register-paths.js',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        ENABLE_WORKER: 'false',
        PORT: 3100,
      },
      out_file: path.join(__dirname, 'logs/crawler-api-out.log'),
      error_file: path.join(__dirname, 'logs/crawler-api-error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'crawler-worker',
      cwd: __dirname,
      script: 'dist/worker.js',
      node_args: '-r ./dist/register-paths.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        ENABLE_WORKER: 'true',
      },
      out_file: path.join(__dirname, 'logs/crawler-worker-out.log'),
      error_file: path.join(__dirname, 'logs/crawler-worker-error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'crawler-web',
      cwd: __dirname,
      script: 'node_modules/serve/build/main.js',
      args: '-s web/dist -l tcp://127.0.0.1:5173',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '5s',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: path.join(__dirname, 'logs/crawler-web-out.log'),
      error_file: path.join(__dirname, 'logs/crawler-web-error.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
