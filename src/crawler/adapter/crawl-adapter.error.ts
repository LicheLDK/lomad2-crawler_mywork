/**
 * 어댑터 계층의 구조화 실패.
 * crawler.service 가 errorCode / responseStatus 를 attempt 행에 기록한다.
 */
export class CrawlAdapterError extends Error {
  readonly errorCode: string;
  readonly responseStatus: number | null;

  constructor(options: {
    message: string;
    errorCode: string;
    responseStatus?: number | null;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'CrawlAdapterError';
    this.errorCode = options.errorCode;
    this.responseStatus = options.responseStatus ?? null;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isTimeoutLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
  return /timeout|aborted/i.test(error.message);
}
