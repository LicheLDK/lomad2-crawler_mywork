import type { AiMatchingItemScores } from './ai.types';

/** Matching 항목 가중치 — Vision 반영 후 재계산용 (ai.service 와 동일) */
const MATCH_WEIGHTS: Record<keyof AiMatchingItemScores, number> = {
  brand: 0.15,
  model: 0.15,
  productName: 0.2,
  price: 0.1,
  option: 0.08,
  color: 0.07,
  image: 0.15,
  description: 0.05,
  ocr: 0.05,
};

/**
 * Vision 이미지 유사도를 Matching 점수에 주입하고,
 * 시각적으로 다른 상품이면 고점수를 강제 하향한다.
 *
 * 예: 텍스트만으로 100점이어도 Vision 15점이면 Case 자동생성 임계치 아래로 떨어짐.
 */
export function applyVisionToMatching(input: {
  scores: AiMatchingItemScores;
  matchingScore: number;
  aiScore: number;
  reason: string;
  visionSimilarity: number;
  visionReason: string;
}): {
  scores: AiMatchingItemScores;
  matchingScore: number;
  aiScore: number;
  reason: string;
} {
  const visionSim = clampScore(input.visionSimilarity);
  const scores: AiMatchingItemScores = {
    ...input.scores,
    image: visionSim,
  };

  let matchingScore = clampScore(input.matchingScore);
  let aiScore = clampScore(input.aiScore);

  const weighted = weightedAverage(scores);

  if (visionSim < 40) {
    // 확연히 다른 제품 — 고점수 차단
    matchingScore = Math.min(matchingScore, Math.max(visionSim + 15, 25));
    aiScore = Math.min(aiScore, matchingScore, Math.max(visionSim + 10, 20));
  } else if (visionSim < 60) {
    // 애매 — 텍스트 고점을 Vision 근처로 제한
    matchingScore = Math.min(matchingScore, visionSim + 25);
    aiScore = Math.min(aiScore, visionSim + 20, matchingScore);
  } else {
    // Vision 동의 — 항목 가중 평균과 블렌드
    matchingScore = clampScore(matchingScore * 0.55 + weighted * 0.45);
    aiScore = clampScore(matchingScore * 0.55 + weighted * 0.45);
  }

  const visionNote = `Vision 이미지 ${visionSim}%: ${input.visionReason}`.trim();
  const reason = input.reason?.trim()
    ? `${input.reason.trim()} | ${visionNote}`
    : visionNote;

  return { scores, matchingScore, aiScore, reason };
}

/** Vision 호출 여부 — 텍스트 매칭이 어느 정도 높을 때만 (비용 절감) */
export function shouldRunVisionCompare(input: {
  matchingScore: number;
  scores: AiMatchingItemScores;
  rentalImageUrl?: string | null;
  listingImageUrl?: string | null;
}): boolean {
  if (!input.rentalImageUrl?.trim() || !input.listingImageUrl?.trim()) {
    return false;
  }
  if (input.matchingScore >= 50) return true;
  if (input.scores.brand >= 60) return true;
  if (input.scores.productName >= 60) return true;
  if (input.scores.model >= 60) return true;
  return false;
}

function weightedAverage(scores: AiMatchingItemScores): number {
  let sum = 0;
  let w = 0;
  for (const key of Object.keys(MATCH_WEIGHTS) as Array<
    keyof AiMatchingItemScores
  >) {
    const weight = MATCH_WEIGHTS[key];
    sum += scores[key] * weight;
    w += weight;
  }
  return w > 0 ? sum / w : 0;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
