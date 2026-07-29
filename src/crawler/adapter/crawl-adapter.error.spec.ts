import { CrawlAdapterError, isTimeoutLike } from './crawl-adapter.error';

describe('CrawlAdapterError', () => {
  it('carries errorCode and responseStatus', () => {
    const err = new CrawlAdapterError({
      message: 'HTTP 403',
      errorCode: 'HTTP_403',
      responseStatus: 403,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.errorCode).toBe('HTTP_403');
    expect(err.responseStatus).toBe(403);
  });

  it('detects timeout-like errors', () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    expect(isTimeoutLike(timeout)).toBe(true);
    expect(isTimeoutLike(new Error('ok'))).toBe(false);
  });
});
