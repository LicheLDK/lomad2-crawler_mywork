import {
  crawlCandidateLimit,
  normalizeKeyword,
  selectTopByTitleSimilarity,
  titleSimilarity,
} from './string.util';

describe('string.util', () => {
  it('normalizeKeyword trims and lowercases', () => {
    expect(normalizeKeyword('  원목   식탁  ')).toBe('원목 식탁');
  });

  it('titleSimilarity is 1 for identical keywords', () => {
    expect(titleSimilarity('시몬스 침대', '시몬스 침대')).toBe(1);
    expect(titleSimilarity('LG 퓨리케어', 'LG 퓨리케어')).toBe(1);
  });

  it('titleSimilarity is higher for closer titles', () => {
    const close = titleSimilarity('원목 식탁', '원목식탁');
    const far = titleSimilarity('원목 식탁', '아이폰 15');
    expect(close).toBeGreaterThan(far);
  });

  it('crawlCandidateLimit scales with keep size', () => {
    expect(crawlCandidateLimit(10)).toBe(50);
    expect(crawlCandidateLimit(50)).toBe(250);
    expect(crawlCandidateLimit(100)).toBe(300);
  });

  it('selectTopByTitleSimilarity keeps highest similarity first', () => {
    const items = [
      { title: '아이폰 케이스', listedAt: new Date('2026-08-01') },
      { title: 'LG 퓨리케어 2단 공기청정기', listedAt: new Date('2026-07-01') },
      { title: 'LG 퓨리케어', listedAt: new Date('2026-06-01') },
      { title: '선풍기 중고', listedAt: new Date('2026-08-02') },
    ];
    const top = selectTopByTitleSimilarity('LG 퓨리케어', items, 2);
    expect(top).toHaveLength(2);
    expect(top[0].title).toBe('LG 퓨리케어');
    expect(top[1].title).toContain('퓨리케어');
  });
});
