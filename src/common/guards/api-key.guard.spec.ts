import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

function mockContext(apiKey?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name.toLowerCase() === 'x-api-key' ? apiKey : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const config = {
    get: jest.fn((key: string) =>
      key === 'app.apiKey' ? 'change-me-api-key' : undefined,
    ),
  } as unknown as ConfigService;

  const guard = new ApiKeyGuard(config);

  it('allows matching x-api-key', () => {
    expect(guard.canActivate(mockContext('change-me-api-key'))).toBe(true);
  });

  it('rejects missing or wrong key', () => {
    expect(() => guard.canActivate(mockContext())).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(mockContext('wrong'))).toThrow(
      UnauthorizedException,
    );
  });
});
