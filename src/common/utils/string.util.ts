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

/**
 * 후보 매물 중 키워드 제목 유사도 상위 limit 건만 남긴다.
 * 동점이면 listedAt 최신 우선.
 */
export function selectTopByTitleSimilarity<
  T extends { title: string; listedAt?: Date | null },
>(keyword: string, items: T[], limit: number): T[] {
  if (limit <= 0 || items.length === 0) return [];

  return [...items]
    .map((item) => ({
      item,
      sim: titleSimilarity(keyword, item.title),
      listed: item.listedAt?.getTime() || 0,
    }))
    .sort((a, b) => b.sim - a.sim || b.listed - a.listed)
    .slice(0, limit)
    .map((row) => row.item);
}

/** 사이트당 최종 보관 수 대비 후보 수집량 (유사도 재선별용) */
export function crawlCandidateLimit(maxResultsPerSite: number): number {
  const keep = Math.max(1, maxResultsPerSite);
  return Math.min(300, Math.max(keep * 5, keep));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
