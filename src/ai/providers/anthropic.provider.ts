import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider } from '../ai.provider';
import {
  AiEngineError,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiProviderName,
} from '../ai.types';

/**
 * Anthropic Provider (Claude)
 * STEP AI-01: Architecture stub — 실제 HTTP 호출 없음.
 */
@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly name: AiProviderName = 'anthropic';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ai.anthropic.apiKey'));
  }

  async complete(
    _request: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    throw new AiEngineError(
      'Anthropic Provider is architecture-only (STEP AI-01). Real API call not implemented yet.',
      'NOT_IMPLEMENTED',
    );
  }
}
