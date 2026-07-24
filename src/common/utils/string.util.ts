import { createHash } from 'crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function normalizeKeyword(keyword: string): string {
  return keyword.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** 간단한 문자열 유사도 (Dice coefficient on bigrams) */
export function titleSimilarity(a: string, b: string): number {
  const left = normalizeKeyword(a);
  const right = normalizeKeyword(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const bigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const gram = s.slice(i, i + 2);
      map.set(gram, (map.get(gram) || 0) + 1);
    }
    return map;
  };

  const aMap = bigrams(left);
  const bMap = bigrams(right);
  let intersection = 0;

  for (const [gram, count] of aMap) {
    const other = bMap.get(gram) || 0;
    intersection += Math.min(count, other);
  }

  return (2 * intersection) / (left.length - 1 + (right.length - 1) || 1);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
