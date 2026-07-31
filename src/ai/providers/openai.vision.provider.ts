import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiVisionProvider } from '../ai.vision.provider';
import {
  AiEngineError,
  type AiImageCompareRequest,
  type AiImageCompareResponse,
  type AiImageItemScores,
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
 * OpenAI Vision Provider — 렌탈 vs 매물 이미지 비교
 */
@Injectable()
export class OpenAiVisionProvider implements AiVisionProvider {
  readonly name: AiProviderName = 'openai';
  private readonly logger = new Logger(OpenAiVisionProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ai.openai.apiKey')?.trim());
  }

  isImplemented(): boolean {
    return true;
  }

  async compareImages(
    request: AiImageCompareRequest,
    options?: { systemPrompt?: string; userPrompt?: string },
  ): Promise<AiImageCompareResponse> {
    const apiKey = this.config.get<string>('ai.openai.apiKey')?.trim();
    if (!apiKey) {
      throw new AiEngineError(
        'OPENAI_API_KEY 가 설정되지 않았습니다.',
        'PROVIDER_UNAVAILABLE',
      );
    }

    const rentalUrl = request.rentalImageUrl?.trim();
    const listingUrl = request.listingImageUrl?.trim();
    if (!rentalUrl || !listingUrl) {
      throw new AiEngineError(
        'rentalImageUrl 과 listingImageUrl 이 필요합니다.',
        'INVALID_REQUEST',
      );
    }

    const model =
      request.model ||
      this.config.get<string>('ai.openai.visionModel') ||
      this.config.get<string>('ai.openai.model') ||
      'gpt-4.1-mini';
    const timeoutMs = this.config.get<number>('ai.timeoutMs') || 60_000;
    const systemPrompt =
      options?.systemPrompt?.trim() ||
      '두 이미지를 비교하고 JSON만 반환하세요.';
    const userPrompt =
      options?.userPrompt?.trim() ||
      '이미지 1=렌탈 상품, 이미지 2=중고 매물. 유사도를 평가하세요.';

    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: { url: rentalUrl, detail: 'low' },
            },
            {
              type: 'image_url',
              image_url: { url: listingUrl, detail: 'low' },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.logger.debug(`OpenAI vision compare model=${model}`);
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
          `OpenAI Vision 응답 JSON 파싱 실패: ${text.slice(0, 200)}`,
          'PROVIDER_ERROR',
        );
      }

      if (!response.ok) {
        const msg =
          parsed.error?.message ||
          text.slice(0, 300) ||
          `HTTP ${response.status}`;
        throw new AiEngineError(
          `OpenAI Vision API 오류: ${msg}`,
          'PROVIDER_ERROR',
        );
      }

      const content = parsed.choices?.[0]?.message?.content?.trim() || '';
      if (!content) {
        throw new AiEngineError(
          'OpenAI Vision 응답에 content 가 없습니다.',
          'PROVIDER_ERROR',
        );
      }

      const compared = parseImageCompareContent(content);
      return {
        provider: 'openai',
        model: parsed.model || model,
        imageSimilarity: compared.imageSimilarity,
        scores: compared.scores,
        reason: compared.reason,
        raw: parsed,
        usage: {
          promptTokens: parsed.usage?.prompt_tokens ?? 0,
          completionTokens: parsed.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof AiEngineError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiEngineError(
          `OpenAI Vision 타임아웃 (${timeoutMs}ms)`,
          'PROVIDER_ERROR',
        );
      }
      throw new AiEngineError(
        `OpenAI Vision 호출 실패: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'PROVIDER_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function parseImageCompareContent(content: string): {
  imageSimilarity: number;
  scores: AiImageItemScores;
  reason: string;
} {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new AiEngineError(
      `Vision JSON 파싱 실패: ${cleaned.slice(0, 200)}`,
      'INVALID_REQUEST',
    );
  }

  const scoresRaw =
    parsed.scores && typeof parsed.scores === 'object'
      ? (parsed.scores as Record<string, unknown>)
      : {};

  const scores: AiImageItemScores = {
    background: clamp(num(scoresRaw.background)),
    composition: clamp(num(scoresRaw.composition)),
    color: clamp(num(scoresRaw.color)),
    furnitureLayout: clamp(
      num(scoresRaw.furnitureLayout ?? scoresRaw.furniture_layout),
    ),
    texture: clamp(num(scoresRaw.texture)),
    logo: clamp(num(scoresRaw.logo)),
    damage: clamp(num(scoresRaw.damage)),
  };

  const similarityRaw = num(
    parsed.imageSimilarity ?? parsed.similarity ?? parsed.score,
  );
  const imageSimilarity = clamp(
    similarityRaw ??
      Math.round(
        (scores.furnitureLayout * 0.35 +
          scores.color * 0.2 +
          scores.composition * 0.15 +
          scores.texture * 0.15 +
          scores.logo * 0.1 +
          scores.background * 0.05) /
          1,
      ),
  );

  const reason =
    typeof parsed.reason === 'string' && parsed.reason.trim()
      ? parsed.reason.trim()
      : 'Vision 이미지 비교 완료';

  return { imageSimilarity, scores, reason };
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function clamp(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
