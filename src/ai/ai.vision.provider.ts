import type {
  AiImageCompareRequest,
  AiImageCompareResponse,
  AiProviderName,
} from './ai.types';

/**
 * AI Vision Provider 계약.
 * 렌탈 이미지 vs 검색 결과 이미지 비교는 이 Provider 만 사용한다.
 * UI / Controller 는 Vision Provider 를 직접 호출하지 않는다.
 * Text 와 동일: AiService 경유 → Prompt → Provider → Cost 기록.
 * 전환: AI_VISION_PROVIDER=openai|anthropic|gemini
 */
export interface AiVisionProvider {
  readonly name: AiProviderName;

  compareImages(
    request: AiImageCompareRequest,
    options?: { systemPrompt?: string; userPrompt?: string },
  ): Promise<AiImageCompareResponse>;

  isConfigured(): boolean;

  /** 실제 API 호출이 구현되어 있는지 여부 (stub → false) */
  isImplemented(): boolean;
}

/** Nest DI 토큰 — AiService 만 주입 */
export const AI_VISION_PROVIDER = Symbol('AI_VISION_PROVIDER');
