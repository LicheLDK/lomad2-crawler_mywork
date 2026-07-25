/**
 * AI Engine — Judgment Engine Principles (FINAL)
 *
 * AI는 단순 채팅이 아니다. Search Crawler Server 의 판단 엔진이다.
 * 모든 AI 기능은 이 원칙을 따른다.
 */
export const AI_ENGINE_PRINCIPLES = [
  '1. 모든 AI 호출은 AI Engine(AiService)을 통해서만 수행한다.',
  '2. Prompt 본문은 코드와 분리한다 (prompt/templates).',
  '3. Provider 는 교체 가능해야 한다 (AiProvider / AiVisionProvider).',
  '4. GPT · Claude · Gemini 를 AI_PROVIDER / AI_VISION_PROVIDER 로 전환한다.',
  '5. Investigation 은 AI 결과(Matching · Rule)를 기반으로 생성한다.',
  '6. AI Recommendation 은 사람의 최종 판단을 돕는 역할이다 (대체하지 않음).',
  '7. AI 호출 로그와 비용을 기록한다 (AiCostService).',
  '8. Vision · OCR · Text 는 동일 구조(Prompt → AiService → Provider → Cost)로 관리한다.',
] as const;

/** Judgment Pipeline — 채팅이 아닌 판단 단계 */
export const AI_JUDGMENT_PIPELINES = [
  'keyword',
  'matching',
  'ocr',
  'image',
  'investigation',
  'recommendation',
  'report',
  'rules',
] as const;

export type AiJudgmentPipeline = (typeof AI_JUDGMENT_PIPELINES)[number];
