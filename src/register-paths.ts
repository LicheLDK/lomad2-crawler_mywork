/**
 * Runtime path alias resolver for compiled dist output.
 * Maps `@/*` → `<dist>/*`
 */
import { register } from 'tsconfig-paths';
import { join } from 'path';

register({
  baseUrl: join(__dirname),
  paths: {
    '@/*': ['./*'],
  },
});
