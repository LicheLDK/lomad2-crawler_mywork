import {
  assertProductionSecrets,
  InsecureProductionSecretsError,
} from './validate-production-secrets';

describe('assertProductionSecrets', () => {
  it('allows example secrets in development', () => {
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'development',
        API_KEY: 'change-me-api-key',
        JWT_SECRET: 'change-me-jwt-secret',
      }),
    ).not.toThrow();
  });

  it('allows missing NODE_ENV (treated as development)', () => {
    expect(() =>
      assertProductionSecrets({
        API_KEY: 'change-me-api-key',
        JWT_SECRET: 'change-me-jwt-secret',
      }),
    ).not.toThrow();
  });

  it('rejects example API_KEY in production', () => {
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'production',
        API_KEY: 'change-me-api-key',
        JWT_SECRET: 'a'.repeat(32),
      }),
    ).toThrow(InsecureProductionSecretsError);
  });

  it('rejects short secrets in production', () => {
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'production',
        API_KEY: 'short-but-not-example',
        JWT_SECRET: 'also-short-not-example',
      }),
    ).toThrow(/at least 24/);
  });

  it('rejects identical API_KEY and JWT_SECRET', () => {
    const shared = 'x'.repeat(32);
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'production',
        API_KEY: shared,
        JWT_SECRET: shared,
      }),
    ).toThrow(/different/);
  });

  it('accepts strong distinct secrets in production', () => {
    expect(() =>
      assertProductionSecrets({
        NODE_ENV: 'production',
        API_KEY: 'prod-api-key-' + 'a'.repeat(24),
        JWT_SECRET: 'prod-jwt-secret-' + 'b'.repeat(24),
      }),
    ).not.toThrow();
  });
});
