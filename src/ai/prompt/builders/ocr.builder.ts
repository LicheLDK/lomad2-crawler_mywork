import type { AiOcrInput } from '../../ai.types';
import type { PromptVars } from '../prompt.types';

export function buildOcrPromptVars(input: AiOcrInput): PromptVars {
  return {
    payload: {
      ocrRawText: truncate(input.rawText, 4000),
      siteCode: input.siteCode ?? null,
      listingTitle: input.listingTitle ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  };
}

function truncate(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
