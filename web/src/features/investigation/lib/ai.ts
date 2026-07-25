import type {
  InvestigationAiAnalysis,
  InvestigationAiRecommendation,
  InvestigationCase,
} from '../types';

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** AI 종합 판단 라벨 (Analysis 패널용) */
export function aiJudgmentLabel(score: number) {
  if (score >= 0.9) return '동일 상품 가능성이 매우 높습니다.';
  if (score >= 0.75) return '동일 상품 가능성이 높습니다.';
  if (score >= 0.5) return '추가 확인이 필요합니다.';
  return '동일 가능성이 낮아 보입니다.';
}

export function deriveAiAnalysis(
  score: number,
  partial?: Partial<InvestigationAiAnalysis>,
): InvestigationAiAnalysis {
  const base = clamp01(score);
  return {
    imageSimilarity: clamp01(
      partial?.imageSimilarity ?? base * 0.98 + 0.01,
    ),
    titleSimilarity: clamp01(partial?.titleSimilarity ?? base * 0.96),
    brandMatch: clamp01(partial?.brandMatch ?? base * 0.92),
    modelMatch: clamp01(partial?.modelMatch ?? base * 0.88),
    priceSimilarity: clamp01(partial?.priceSimilarity ?? base * 0.75 + 0.1),
    ocrMatch: clamp01(partial?.ocrMatch ?? base * 0.85),
  };
}

export function toPct(score: number) {
  return Math.round(clamp01(score) * 100);
}

export function clampScore(score: number) {
  return clamp01(score);
}

/**
 * AI Recommendation — 서버 값 우선, 없으면 AI Score 기반 fallback
 * (Investigation Summary 와 분리)
 */
export function deriveAiRecommendation(
  row: InvestigationCase,
): InvestigationAiRecommendation {
  if (row.aiRecommendation?.headline) {
    return {
      stars: Math.max(1, Math.min(5, Math.round(row.aiRecommendation.stars || 3))),
      headline: row.aiRecommendation.headline,
      actions:
        row.aiRecommendation.actions?.length
          ? row.aiRecommendation.actions
          : ['증거 저장', '담당자 지정', '추가 조사'],
      reasons:
        row.aiRecommendation.reasons?.length
          ? row.aiRecommendation.reasons
          : ['AI Matching 결과를 바탕으로 추가 조치가 권장됩니다.'],
    };
  }

  const score = clamp01(row.aiScore);
  const stars =
    score >= 0.9 ? 5 : score >= 0.75 ? 4 : score >= 0.55 ? 3 : score >= 0.35 ? 2 : 1;

  return {
    stars,
    headline:
      stars >= 5
        ? '재판매 가능성이 매우 높습니다.'
        : stars >= 4
          ? '재판매 가능성이 높습니다.'
          : stars >= 3
            ? '추가 확인이 필요합니다.'
            : stars >= 2
              ? '재판매 가능성은 보통입니다.'
              : '재판매 가능성은 낮아 보입니다.',
    actions: ['증거 저장', '담당자 지정', '추가 조사'],
    reasons: [
      score >= 0.75
        ? 'AI Score가 높아 동일 상품 가능성이 큽니다.'
        : 'AI Score와 매칭 항목을 추가로 검토하세요.',
      '증거 저장 후 담당자 배정을 권장합니다.',
    ],
  };
}
