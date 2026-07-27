/**
 * 운영(NODE_ENV=production)에서 예제/빈 비밀값으로 기동되는 것을 막는다.
 * 로컬 development 에서는 예제값(change-me-*)을 허용한다.
 */

const FORBIDDEN_API_KEYS = new Set([
  '',
  'change-me-api-key',
  'changeme',
  'api-key',
  'secret',
]);

const FORBIDDEN_JWT_SECRETS = new Set([
  '',
  'change-me-jwt-secret',
  'changeme',
  'secret',
  'jwt-secret',
]);

const MIN_SECRET_LENGTH = 24;

export type ProductionSecretsEnv = {
  NODE_ENV?: string;
  API_KEY?: string;
  JWT_SECRET?: string;
};

export class InsecureProductionSecretsError extends Error {
  constructor(public readonly reasons: string[]) {
    super(
      `Refusing to start in production with insecure secrets:\n- ${reasons.join('\n- ')}`,
    );
    this.name = 'InsecureProductionSecretsError';
  }
}

export function assertProductionSecrets(
  env: ProductionSecretsEnv = process.env,
): void {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  if (nodeEnv !== 'production') {
    return;
  }

  const reasons: string[] = [];
  const apiKey = (env.API_KEY ?? '').trim();
  const jwtSecret = (env.JWT_SECRET ?? '').trim();

  if (
    FORBIDDEN_API_KEYS.has(apiKey) ||
    apiKey.toLowerCase().startsWith('change-me')
  ) {
    reasons.push(
      'API_KEY is missing or still an example value (e.g. change-me-api-key)',
    );
  } else if (apiKey.length < MIN_SECRET_LENGTH) {
    reasons.push(`API_KEY must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  if (
    FORBIDDEN_JWT_SECRETS.has(jwtSecret) ||
    jwtSecret.toLowerCase().startsWith('change-me')
  ) {
    reasons.push(
      'JWT_SECRET is missing or still an example value (e.g. change-me-jwt-secret)',
    );
  } else if (jwtSecret.length < MIN_SECRET_LENGTH) {
    reasons.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  if (apiKey && jwtSecret && apiKey === jwtSecret) {
    reasons.push('API_KEY and JWT_SECRET must be different values');
  }

  if (reasons.length > 0) {
    throw new InsecureProductionSecretsError(reasons);
  }
}
