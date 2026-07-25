/** Prompt Catalog — 코드에 Prompt 본문 없음. key만 정의 */
export const PROMPT_KEYS = [
  'keyword',
  'matching',
  'investigation',
  'recommendation',
  'image',
  'ocr',
  'report',
] as const;

export type PromptKey = (typeof PROMPT_KEYS)[number];

export const KEYWORD_MAX_COUNT = 20;

export function isPromptKey(value: string): value is PromptKey {
  return (PROMPT_KEYS as readonly string[]).includes(value);
}
