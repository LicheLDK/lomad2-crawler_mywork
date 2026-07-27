import { registerAs } from '@nestjs/config';

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'search-crawler-server',
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3100', 10),
  // 개발만 예제 기본값 허용. 운영은 bootstrap assertProductionSecrets 가 차단.
  apiKey:
    process.env.API_KEY ||
    (isProduction ? '' : 'change-me-api-key'),
  jwtSecret:
    process.env.JWT_SECRET ||
    (isProduction ? '' : 'change-me-jwt-secret'),
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
  rateLimitLimit: parseInt(process.env.RATE_LIMIT_LIMIT || '100', 10),
}));
