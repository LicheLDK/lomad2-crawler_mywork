import type { PromptVars } from './prompt.types';

/**
 * Mustache-lite: {{key}} 치환.
 * 값이 object/array 이면 JSON pretty 문자열.
 * 빈 값은 빈 문자열.
 */
export function renderPromptTemplate(
  template: string,
  vars: PromptVars,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, rawKey: string) => {
    if (!(rawKey in vars)) return '';
    const value = vars[rawKey];
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value, null, 2);
  });
}
