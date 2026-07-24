import { registerAs } from '@nestjs/config';

export default registerAs('elastic', () => ({
  node: process.env.ELASTIC_NODE || 'http://127.0.0.1:9200',
  index: process.env.ELASTIC_INDEX || 'crawler_results',
  username: process.env.ELASTIC_USERNAME || undefined,
  password: process.env.ELASTIC_PASSWORD || undefined,
}));
