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
    /**
     * Matching 후 Vision 이미지 비교로 image 점수 보정 (기본 true).
     * canCompareImages() 이고 양쪽에 이미지 URL이 있으며 텍스트 점수가 높을 때만 호출.
     * localImageGate=true 이면 LooksSame/OpenCV threshold 통과 후보만 Vision 호출.
     */
    visionBeforeMatch:
      (process.env.AI_VISION_BEFORE_MATCH || 'true').toLowerCase() === 'true',
    /**
     * Vision 직전 로컬 게이트 (기본 true, 비용 0).
     * Color → pHash → LooksSame + SSIM + OpenCV. threshold 미통과 시 Vision 스킵.
     */
    localImageGate:
      (process.env.AI_LOCAL_IMAGE_GATE || 'true').toLowerCase() !== 'false',
    /** 색 히스토그램 이하면 Vision block */
    localColorRejectThreshold: parseInt(
      process.env.AI_LOCAL_COLOR_REJECT_THRESHOLD || '35',
      10,
    ),
    /** pHash 이하면 Vision block */
    localPHashRejectThreshold: parseInt(
      process.env.AI_LOCAL_PHASH_REJECT_THRESHOLD || '30',
      10,
    ),
    /** pHash 이상이면 거의 동일 → Vision 스킵(고점수) */
    localPHashPassThreshold: parseInt(
      process.env.AI_LOCAL_PHASH_PASS_THRESHOLD || '90',
      10,
    ),
    /** SSIM ≥ 이면 Vision 후보 (LooksSame 보완) */
    localSsimThreshold: parseInt(
      process.env.AI_LOCAL_SSIM_THRESHOLD || '75',
      10,
    ),
    /** SSIM ≥ 이면 거의 동일 → Vision 스킵(고점수) */
    localSsimPassThreshold: parseInt(
      process.env.AI_LOCAL_SSIM_PASS_THRESHOLD || '92',
      10,
    ),
    localLooksSameThreshold: parseInt(
      process.env.AI_LOCAL_LOOKS_SAME_THRESHOLD || '70',
      10,
    ),
    localOpenCvThreshold: parseInt(
      process.env.AI_LOCAL_OPENCV_THRESHOLD || '60',
      10,
    ),
    localLooksSameStrict:
      (process.env.AI_LOCAL_LOOKS_SAME_STRICT || 'false').toLowerCase() ===
      'true',
    localLooksSameTolerance: parseFloat(
      process.env.AI_LOCAL_LOOKS_SAME_TOLERANCE || '2.5',
    ),
    localLooksSameIgnoreAntialiasing:
      (process.env.AI_LOCAL_LOOKS_SAME_IGNORE_ANTIALIASING || 'true').toLowerCase() !==
      'false',
    localOpenCvOrbNfeatures: parseInt(
      process.env.AI_LOCAL_OPENCV_ORB_NFEATURES || '500',
      10,
    ),
    localOpenCvOrbMatchRatio: parseFloat(
      process.env.AI_LOCAL_OPENCV_ORB_MATCH_RATIO || '0.75',
    ),
    localPreprocessMaxWidth: parseInt(
      process.env.AI_LOCAL_PREPROCESS_MAX_WIDTH || '512',
      10,
    ),
    localPreprocessMaxHeight: parseInt(
      process.env.AI_LOCAL_PREPROCESS_MAX_HEIGHT || '512',
      10,
    ),
    localPreprocessBackground: (
      process.env.AI_LOCAL_PREPROCESS_BACKGROUND || 'ffffff'
    ).replace(/^#/, ''),
    localPreprocessNormalize:
      (process.env.AI_LOCAL_PREPROCESS_NORMALIZE || 'true').toLowerCase() !==
      'false',

    /**
     * Matching LLM 1차 배치 상한 (titleSimilarity 상위 N).
     * 기본 25 — 검색 결과가 많을 때 커버리지 확대.
     */
    matchBatchLimit: parseInt(process.env.AI_MATCH_BATCH_LIMIT || '25', 10),

    /**
     * 2차 패스: 1차 미포함 후보 중 추가 LLM 매칭 수.
     * 0이면 2차 비활성. 로컬 이미지 게이트가 켜져 있으면 로컬 유사도 우선 선별.
     */
    matchSecondPassLimit: parseInt(
      process.env.AI_MATCH_SECOND_PASS_LIMIT || '10',
      10,
    ),

    /** 2차 패스 후보의 최소 titleSimilarity (0~1) */
    matchSecondPassMinTitle: parseFloat(
      process.env.AI_MATCH_SECOND_PASS_MIN_TITLE || '0.2',
    ),
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
