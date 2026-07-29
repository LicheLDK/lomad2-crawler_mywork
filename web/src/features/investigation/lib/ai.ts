import type {
  InvestigationAiAnalysis,
  InvestigationAiRecommendation,
  InvestigationCase,
} from '../types';

const AI_ANALYSIS_KEYS: (keyof InvestigationAiAnalysis)[] = [
  'imageSimilarity',
  'titleSimilarity',
  'brandMatch',
  'modelMatch',
  'priceSimilarity',
  'ocrMatch',
];

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** 6개 메트릭이 모두 있으면 완전한 InvestigationAiAnalysis */
export function isCompleteAiAnalysis(
  value: Partial<InvestigationAiAnalysis> | undefined | null,
): value is InvestigationAiAnalysis {
  if (!value) return false;
  return AI_ANALYSIS_KEYS.every(
    (k) => typeof value[k] === 'number' && Number.isFinite(value[k] as number),
  );
}

/** AI 종합 판단 라벨 (Analysis 패널용) */
export function aiJudgmentLabel(score: number) {
  if (score >= 0.9) return '동일 상품 가능성이 매우 높습니다.';
  if (score >= 0.75) return '동일 상품 가능성이 높습니다.';
  if (score >= 0.5) return '추가 확인이 필요합니다.';
  return '동일 가능성이 낮아 보입니다.';
}

/**
 * 서버 aiAnalysis 만 사용. 불완전하면 null (클라이언트 휴리스틱 제거 — D-7).
 */
export function resolveAiAnalysis(
  row: InvestigationCase,
): InvestigationAiAnalysis | null {
  if (!isCompleteAiAnalysis(row.aiAnalysis)) return null;
  return {
    imageSimilarity: clamp01(row.aiAnalysis.imageSimilarity),
    titleSimilarity: clamp01(row.aiAnalysis.titleSimilarity),
    brandMatch: clamp01(row.aiAnalysis.brandMatch),
    modelMatch: clamp01(row.aiAnalysis.modelMatch),
    priceSimilarity: clamp01(row.aiAnalysis.priceSimilarity),
    ocrMatch: clamp01(row.aiAnalysis.ocrMatch),
  };
}

export function toPct(score: number) {
  return Math.round(clamp01(score) * 100);
}

export function clampScore(score: number) {
  return clamp01(score);
}

/**
 * 서버 aiRecommendation 만 사용. 없으면 null (휴리스틱 제거 — D-7).
 */
export function resolveAiRecommendation(
  row: InvestigationCase,
): InvestigationAiRecommendation | null {
  if (!row.aiRecommendation?.headline?.trim()) return null;
  return {
    stars: Math.max(
      1,
      Math.min(5, Math.round(row.aiRecommendation.stars || 3)),
    ),
    headline: row.aiRecommendation.headline.trim(),
    actions: row.aiRecommendation.actions?.length
      ? row.aiRecommendation.actions
      : [],
    reasons: row.aiRecommendation.reasons?.length
      ? row.aiRecommendation.reasons
      : [],
  };
}
