import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiVisionProvider } from '../ai.vision.provider';
import {
  AiEngineError,
  type AiImageCompareRequest,
  type AiImageCompareResponse,
  type AiProviderName,
} from '../ai.types';

/**
 * OpenAI Vision Provider
 * STEP AI-06: Interface stub — 실제 Vision API 호출 없음
 */
@Injectable()
export class OpenAiVisionProvider implements AiVisionProvider {
  readonly name: AiProviderName = 'openai';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ai.openai.apiKey')?.trim());
  }

  isImplemented(): boolean {
    return false;
  }

  async compareImages(
    _request: AiImageCompareRequest,
    _options?: { systemPrompt?: string; userPrompt?: string },
  ): Promise<AiImageCompareResponse> {
    throw new AiEngineError(
      'OpenAI Vision Provider is interface-only (STEP AI-06). Real Vision API not implemented yet.',
      'NOT_IMPLEMENTED',
    );
  }
}
