import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProviderName,
} from './ai.types';

/**
 * AI Provider 계약.
 * 모든 LLM 벤더(GPT / Claude / Gemini)는 이 인터페이스만 구현한다.
 * UI / Nest Controller 는 Provider 를 직접 주입받지 않는다.
 * 전환: AI_PROVIDER=openai|anthropic|gemini
 */
export interface AiProvider {
  readonly name: AiProviderName;

  /** Text LLM completion (Keyword · Matching · OCR · Investigation · …) */
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;

  /** Provider 사용 가능 여부 (키/설정) */
  isConfigured(): boolean;
}

/** Nest DI 토큰 — AiService 만 이 Provider 를 주입받는다 */
export const AI_PROVIDER = Symbol('AI_PROVIDER');
