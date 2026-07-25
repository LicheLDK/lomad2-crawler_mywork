/**
 * AI 모델별 단가 (USD / 1M tokens)
 * env AI_COST_PRICES_JSON 으로 오버라이드 가능
 *
 * 예: {"gpt-4.1-mini":{"inputPer1M":0.4,"outputPer1M":1.6}}
 */
export type AiModelPrice = {
  inputPer1M: number;
  outputPer1M: number;
};

export const DEFAULT_AI_MODEL_PRICES: Record<string, AiModelPrice> = {
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
  'gpt-4.1': { inputPer1M: 2.0, outputPer1M: 8.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'claude-sonnet-4-20250514': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-sonnet-latest': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.3 },
};

/** 미등록 모델 fallback */
export const FALLBACK_AI_MODEL_PRICE: AiModelPrice = {
  inputPer1M: 1.0,
  outputPer1M: 3.0,
};

export function resolveModelPrice(
  model: string,
  overrides?: Record<string, AiModelPrice> | null,
): AiModelPrice {
  const key = model.trim().toLowerCase();
  if (overrides) {
    for (const [name, price] of Object.entries(overrides)) {
      if (name.toLowerCase() === key || key.includes(name.toLowerCase())) {
        return price;
      }
    }
  }
  for (const [name, price] of Object.entries(DEFAULT_AI_MODEL_PRICES)) {
    if (name.toLowerCase() === key || key.includes(name.toLowerCase())) {
      return price;
    }
  }
  return FALLBACK_AI_MODEL_PRICE;
}

export function estimateCostUsd(params: {
  model: string;
  promptTokens: number;
  completionTokens: number;
  overrides?: Record<string, AiModelPrice> | null;
}): number {
  const price = resolveModelPrice(params.model, params.overrides);
  const input =
    (Math.max(0, params.promptTokens) / 1_000_000) * price.inputPer1M;
  const output =
    (Math.max(0, params.completionTokens) / 1_000_000) * price.outputPer1M;
  return roundCost(input + output);
}

export function roundCost(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function parsePriceOverrides(
  raw?: string | null,
): Record<string, AiModelPrice> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, AiModelPrice> = {};
    for (const [model, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      const inputPer1M = Number(row.inputPer1M ?? row.input);
      const outputPer1M = Number(row.outputPer1M ?? row.output);
      if (!Number.isFinite(inputPer1M) || !Number.isFinite(outputPer1M)) {
        continue;
      }
      out[model] = { inputPer1M, outputPer1M };
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
