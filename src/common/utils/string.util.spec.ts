import { normalizeKeyword, titleSimilarity } from './string.util';

describe('string.util', () => {
  it('normalizeKeyword trims and lowercases', () => {
    expect(normalizeKeyword('  원목   식탁  ')).toBe('원목 식탁');
  });

  it('titleSimilarity is 1 for identical keywords', () => {
    expect(titleSimilarity('시몬스 침대', '시몬스 침대')).toBe(1);
  });

  it('titleSimilarity is higher for closer titles', () => {
    const close = titleSimilarity('원목 식탁', '원목식탁');
    const far = titleSimilarity('원목 식탁', '아이폰 15');
    expect(close).toBeGreaterThan(far);
  });
});
