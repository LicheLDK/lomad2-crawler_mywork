import type { AiRuleDefinition } from './ai-rule.types';

/**
 * 기본 AI Rules (Config 데이터 — 평가 로직에 하드코딩하지 않음)
 *
 * 예:
 *  - AI Score >= 90 → 자동 Investigation 생성
 *  - AI Score < 50 → 자동 제외
 *  - 가격 차이 70% 이상 → Warning
 *
 * INVESTIGATION_AI_SCORE_THRESHOLD 가 있으면 create 규칙 value 를 덮어쓴다.
 * AI_RULES_JSON 으로 전체 교체 가능.
 */
export function buildDefaultAiRules(
  createThreshold = 90,
): AiRuleDefinition[] {
  const threshold = clamp(createThreshold, 0, 100);
  return [
    {
      code: 'auto_exclude_low_score',
      name: '낮은 AI Score 자동 제외',
      description: 'AI Score 가 기준 미만이면 Investigation 생성하지 않음',
      enabled: true,
      priority: 200,
      field: 'aiScore',
      operator: 'lt',
      value: 50,
      action: 'exclude',
      message: 'AI Score < 50 — 자동 제외',
    },
    {
      code: 'auto_create_high_score',
      name: '높은 AI Score 자동 Investigation',
      description: 'AI Score 가 기준 이상이면 Investigation 자동 생성',
      enabled: true,
      priority: 100,
      field: 'aiScore',
      operator: 'gte',
      value: threshold,
      action: 'create_investigation',
      message: `AI Score >= ${threshold} — Investigation 자동 생성`,
    },
    {
      code: 'price_diff_warning',
      name: '가격 차이 Warning',
      description: '렌탈가 대비 매물 가격 차이가 크면 Warning',
      enabled: true,
      priority: 50,
      field: 'priceDiffPercent',
      operator: 'gte',
      value: 70,
      action: 'warning',
      message: '가격 차이 70% 이상 — Warning',
    },
  ];
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
