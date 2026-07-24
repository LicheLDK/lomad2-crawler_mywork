import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'search-crawler-server',
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3100', 10),
  apiKey: process.env.API_KEY || 'change-me-api-key',
  jwtSecret: process.env.JWT_SECRET || 'change-me-jwt-secret',
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
  rateLimitLimit: parseInt(process.env.RATE_LIMIT_LIMIT || '100', 10),
}));
