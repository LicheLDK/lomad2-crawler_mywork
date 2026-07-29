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

  const resolvedProvider: AiProviderName = ['openai', 'anthropic', 'gemini'].includes(provider)
    ? provider
    : 'openai';

  const visionProvider = (['openai', 'anthropic', 'gemini'].includes(
    (process.env.AI_VISION_PROVIDER || resolvedProvider).toLowerCase(),
  )
    ? (process.env.AI_VISION_PROVIDER || resolvedProvider).toLowerCase()
    : resolvedProvider) as AiProviderName;

  return {
    enabled: resolveEnabled(resolvedProvider, visionProvider),
    provider: resolvedProvider,
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
    visionProvider,
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
    /** Matching 전 OCR 분석 결과를 prompt에 포함 */
    ocrBeforeMatch: (process.env.AI_OCR_BEFORE_MATCH || 'false').toLowerCase() === 'true',
  };
});

const PROVIDER_KEY_MAP: Record<AiProviderName, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

function resolveEnabled(
  provider: AiProviderName,
  visionProvider: AiProviderName,
): boolean {
  if (process.env.AI_ENABLED !== undefined && process.env.AI_ENABLED !== '') {
    return process.env.AI_ENABLED.toLowerCase() === 'true';
  }
  return !!(
    process.env[PROVIDER_KEY_MAP[provider]] ||
    process.env[PROVIDER_KEY_MAP[visionProvider]]
  );
}

function parseAiRulesJson(raw?: string) {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
