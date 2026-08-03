import { parseListedAt } from './listed-at.util';

describe('parseListedAt', () => {
  const now = new Date('2026-08-03T12:00:00+09:00');

  it('유닉스 초 → Date', () => {
    const d = parseListedAt(1782830370);
    expect(d?.toISOString()).toBe(new Date(1782830370 * 1000).toISOString());
  });

  it('KST wall clock 문자열', () => {
    const d = parseListedAt('2026-01-26 19:19:02');
    expect(d?.toISOString()).toBe('2026-01-26T10:19:02.000Z');
  });

  it('점 구분 날짜', () => {
    const d = parseListedAt('2026.01.26');
    expect(d?.toISOString()).toBe('2026-01-25T15:00:00.000Z');
  });

  it('한국어 상대시각', () => {
    expect(parseListedAt('3시간 전', now)?.getTime()).toBe(
      now.getTime() - 3 * 3_600_000,
    );
    expect(parseListedAt('어제', now)?.getTime()).toBe(
      now.getTime() - 86_400_000,
    );
    expect(parseListedAt('방금', now)?.getTime()).toBe(now.getTime());
  });

  it('빈 값', () => {
    expect(parseListedAt(null)).toBeNull();
    expect(parseListedAt('')).toBeNull();
    expect(parseListedAt('nonsense')).toBeNull();
  });
});
