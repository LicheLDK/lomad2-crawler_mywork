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
 * Anthropic Vision Provider (Claude)
 * STEP AI-06: Interface stub — 실제 Vision API 호출 없음
 */
@Injectable()
export class AnthropicVisionProvider implements AiVisionProvider {
  readonly name: AiProviderName = 'anthropic';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ai.anthropic.apiKey')?.trim());
  }

  async compareImages(
    _request: AiImageCompareRequest,
  ): Promise<AiImageCompareResponse> {
    throw new AiEngineError(
      'Anthropic Vision Provider is interface-only (STEP AI-06). Real Vision API not implemented yet.',
      'NOT_IMPLEMENTED',
    );
  }
}
