import { registerAs } from '@nestjs/config';

export default registerAs('crawler', () => ({
  headless: (process.env.PLAYWRIGHT_HEADLESS || 'true') === 'true',
  timeoutMs: parseInt(process.env.CRAWLER_TIMEOUT_MS || '30000', 10),
  navigationTimeoutMs: parseInt(
    process.env.CRAWLER_NAVIGATION_TIMEOUT_MS || '45000',
    10,
  ),
  userAgent:
    process.env.CRAWLER_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  requestDelayMs: parseInt(process.env.CRAWLER_REQUEST_DELAY_MS || '1500', 10),
  proxyUrl: process.env.CRAWLER_PROXY_URL || undefined,
  searchCacheTtlSeconds: parseInt(
    process.env.SEARCH_CACHE_TTL_SECONDS || '3600',
    10,
  ),
}));
