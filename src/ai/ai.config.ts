import { registerAs } from '@nestjs/config';
import type { AiProviderName } from './ai.types';

/**
 * AI Engine 설정.
 * Provider 전환: AI_PROVIDER=openai|anthropic|gemini
 * STEP AI-01: Architecture only — 실제 API 키는 이후 STEP 에서 사용.
 */
export default registerAs('ai', () => {
  const provider = (
    process.env.AI_PROVIDER || 'openai'
  ).toLowerCase() as AiProviderName;

  return {
    // OPENAI_API_KEY 가 있으면 Keyword Generator 기본 활성 (AI_ENABLED 로 끌 수 있음)
    enabled:
      (
        process.env.AI_ENABLED ||
        (process.env.OPENAI_API_KEY ? 'true' : 'false')
      ).toLowerCase() === 'true',
    provider: (['openai', 'anthropic', 'gemini'].includes(provider)
      ? provider
      : 'openai') as AiProviderName,
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '60000', 10),
    defaultTemperature: parseFloat(process.env.AI_TEMPERATURE || '0.2'),
    defaultMaxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      visionModel:
        process.env.OPENAI_VISION_MODEL ||
        process.env.OPENAI_MODEL ||
        'gpt-4.1-mini',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      visionModel:
        process.env.ANTHROPIC_VISION_MODEL ||
        process.env.ANTHROPIC_MODEL ||
        'claude-sonnet-4-20250514',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      visionModel:
        process.env.GEMINI_VISION_MODEL ||
        process.env.GEMINI_MODEL ||
        'gemini-2.0-flash',
    },
    /** Vision Provider (미설정 시 AI_PROVIDER 와 동일) */
    visionProvider: (['openai', 'anthropic', 'gemini'].includes(
      (process.env.AI_VISION_PROVIDER || provider).toLowerCase(),
    )
      ? (process.env.AI_VISION_PROVIDER || provider).toLowerCase()
      : provider) as AiProviderName,
    /** 실패 시 재시도 횟수 (0 = 재시도 없음) */
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '2', 10),
    /** 재시도 대기 ms */
    retryDelayMs: parseInt(process.env.AI_RETRY_DELAY_MS || '500', 10),
    /** 모델 단가 오버라이드 JSON */
    costPricesJson: process.env.AI_COST_PRICES_JSON || '',
    /**
     * AI Rules (JSON 배열). 비어 있으면 default-rules + INVESTIGATION_AI_SCORE_THRESHOLD.
     * 예: [{"code":"auto_create_high_score","name":"...","field":"aiScore","operator":"gte","value":90,"action":"create_investigation"}]
     */
    rules: parseAiRulesJson(process.env.AI_RULES_JSON),
  };
});

function parseAiRulesJson(raw?: string) {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
