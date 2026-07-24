import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'crawler',
  password: process.env.DB_PASSWORD || 'crawler',
  database: process.env.DB_NAME || 'search_crawler',
}));
