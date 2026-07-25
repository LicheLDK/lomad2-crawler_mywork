import type { AiKeywordInput } from '../../ai.types';
import { KEYWORD_MAX_COUNT } from '../catalog';
import type { PromptVars } from '../prompt.types';

export function buildKeywordPromptVars(input: AiKeywordInput): PromptVars {
  return {
    maxCount: KEYWORD_MAX_COUNT,
    payload: {
      brand: input.brand ?? null,
      productName: input.productName ?? null,
      modelName: input.modelName ?? null,
      option: input.option ?? null,
      color: input.color ?? null,
    },
  };
}
