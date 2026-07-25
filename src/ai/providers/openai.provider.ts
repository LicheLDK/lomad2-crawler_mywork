import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider } from '../ai.provider';
import {
  AiEngineError,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiMessage,
  type AiProviderName,
} from '../ai.types';

type OpenAiChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { role?: string; content?: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; type?: string };
};

/**
 * OpenAI Provider (GPT)
 * STEP AI-02: Chat Completions 실제 호출 (Keyword 등)
 */
@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name: AiProviderName = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ai.openai.apiKey')?.trim());
  }

  async complete(
    request: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    const apiKey = this.config.get<string>('ai.openai.apiKey')?.trim();
    if (!apiKey) {
      throw new AiEngineError(
        'OPENAI_API_KEY 가 설정되지 않았습니다.',
        'PROVIDER_UNAVAILABLE',
      );
    }

    const model =
      request.model ||
      this.config.get<string>('ai.openai.model') ||
      'gpt-4.1-mini';
    const temperature =
      request.temperature ??
      this.config.get<number>('ai.defaultTemperature') ??
      0.2;
    const maxTokens =
      request.maxTokens ??
      this.config.get<number>('ai.defaultMaxTokens') ??
      2048;
    const timeoutMs = this.config.get<number>('ai.timeoutMs') || 60_000;

    const body: Record<string, unknown> = {
      model,
      messages: toOpenAiMessages(request.messages),
      temperature,
      max_tokens: maxTokens,
    };

    // Keyword 등 JSON 스키마 작업은 json_object 강제
    if (
      request.task === 'keyword' ||
      request.task === 'matching' ||
      request.task === 'investigation' ||
      request.task === 'recommendation' ||
      request.task === 'ocr' ||
      request.task === 'report'
    ) {
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.logger.debug(`OpenAI chat.completions model=${model} task=${request.task}`);
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );

      const text = await response.text();
      let parsed: OpenAiChatResponse = {};
      try {
        parsed = text ? (JSON.parse(text) as OpenAiChatResponse) : {};
      } catch {
        throw new AiEngineError(
          `OpenAI 응답 JSON 파싱 실패: ${text.slice(0, 200)}`,
          'PROVIDER_ERROR',
        );
      }

      if (!response.ok) {
        const msg =
          parsed.error?.message ||
          text.slice(0, 300) ||
          `HTTP ${response.status}`;
        throw new AiEngineError(
          `OpenAI API 오류: ${msg}`,
          'PROVIDER_ERROR',
        );
      }

      const content = parsed.choices?.[0]?.message?.content?.trim() || '';
      if (!content) {
        throw new AiEngineError(
          'OpenAI 응답에 content 가 없습니다.',
          'PROVIDER_ERROR',
        );
      }

      return {
        provider: 'openai',
        model: parsed.model || model,
        content,
        raw: parsed,
        usage: {
          promptTokens: parsed.usage?.prompt_tokens,
          completionTokens: parsed.usage?.completion_tokens,
          totalTokens: parsed.usage?.total_tokens,
        },
      };
    } catch (error) {
      if (error instanceof AiEngineError) throw error;
      const message =
        error instanceof Error ? error.message : String(error);
      throw new AiEngineError(
        `OpenAI 요청 실패: ${message}`,
        'PROVIDER_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function toOpenAiMessages(
  messages: AiMessage[],
): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
