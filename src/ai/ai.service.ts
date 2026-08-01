import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageStorageService } from '@/storage/image-storage.service';
import { AI_PROVIDER, type AiProvider } from './ai.provider';
import {
  AI_VISION_PROVIDER,
  type AiVisionProvider,
} from './ai.vision.provider';
import { AiCostService } from './cost/ai-cost.service';
import { PromptManagerService } from './prompt/prompt-manager.service';
import {
  AiEngineError,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiImageCompareRequest,
  type AiImageCompareResponse,
  type AiInvestigationInput,
  type AiInvestigationResult,
  type AiKeywordInput,
  type AiKeywordResult,
  type AiListingCandidate,
  type AiMatchingInput,
  type AiMatchingItemScores,
  type AiMatchingResult,
  type AiOcrFields,
  type AiOcrInput,
  type AiOcrResult,
  type AiProviderName,
  type AiRecommendationResult,
  type AiRentalProduct,
  type AiReportDocument,
  type AiReportEvidenceItem,
  type AiReportInput,
  type AiReportResult,
  type AiReportTimelineItem,
} from './ai.types';
import { buildImagePromptVars } from './prompt/builders/image.builder';
import { buildInvestigationPromptVars } from './prompt/builders/investigation.builder';
import { buildKeywordPromptVars } from './prompt/builders/keyword.builder';
import { KEYWORD_MAX_COUNT } from './prompt/catalog';
import { buildMatchingPromptVars } from './prompt/builders/matching.builder';
import { buildOcrPromptVars } from './prompt/builders/ocr.builder';
import { buildRecommendationPromptVars } from './prompt/builders/recommendation.builder';
import { buildReportPromptVars } from './prompt/builders/report.builder';
import { renderReportHtml } from './template/report.template';
import {
  applyVisionToMatching,
  shouldRunVisionCompare,
} from './matching-vision.util';
import { applyLocalToMatching } from './local-image/apply-local-to-matching';
import { MatchingLocalImageService } from './local-image/matching-local-image.service';

/** Matching 항목 가중치 — 최종 AI Score 산출 (ai.service 로직) */
const MATCH_WEIGHTS: Record<keyof AiMatchingItemScores, number> = {
  brand: 0.15,
  model: 0.15,
  productName: 0.2,
  price: 0.1,
  option: 0.08,
  color: 0.07,
  image: 0.15,
  description: 0.05,
  ocr: 0.05,
};

const MATCH_BATCH_LIMIT_DEFAULT = 25;
const MATCH_CONCURRENCY = 2;

/**
 * AI Engine Service — 유일한 진입점.
 * UI / Controller 는 Provider 를 직접 호출하지 않는다.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    @Inject(AI_VISION_PROVIDER) private readonly visionProvider: AiVisionProvider,
    private readonly config: ConfigService,
    private readonly costService: AiCostService,
    private readonly promptManager: PromptManagerService,
    private readonly imageStorage: ImageStorageService,
    private readonly matchingLocalImage: MatchingLocalImageService,
  ) {}

  getActiveProvider(): AiProviderName {
    return this.provider.name;
  }

  getActiveVisionProvider(): AiProviderName {
    return this.visionProvider.name;
  }

  isEnabled(): boolean {
    return this.config.get<boolean>('ai.enabled') === true;
  }

  /** Keyword Generator 사용 가능 (키 설정 + AI_ENABLED + 실제 구현) */
  canGenerateKeywords(): boolean {
    return this.isEnabled() && this.provider.isConfigured() && this.provider.isImplemented();
  }

  /** Matching Engine 사용 가능 */
  canMatch(): boolean {
    return this.isEnabled() && this.provider.isConfigured() && this.provider.isImplemented();
  }

  async complete(
    request: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    if (!this.isEnabled()) {
      throw new AiEngineError(
        'AI Engine is disabled (AI_ENABLED=false).',
        'PROVIDER_UNAVAILABLE',
      );
    }
    if (!this.provider.isConfigured()) {
      throw new AiEngineError(
        `AI Provider "${this.provider.name}" is not configured.`,
        'PROVIDER_UNAVAILABLE',
      );
    }

    const maxRetries = Math.max(
      0,
      this.config.get<number>('ai.maxRetries') ?? 2,
    );
    const retryDelayMs = Math.max(
      0,
      this.config.get<number>('ai.retryDelayMs') ?? 500,
    );
    const promptText = request.messages
      .map((m) => `[${m.role}]\n${m.content}`)
      .join('\n\n');

    this.logger.debug(
      `AI complete task=${request.task} provider=${this.provider.name} maxRetries=${maxRetries}`,
    );

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      const started = Date.now();
      try {
        const response = await this.provider.complete(request);
        const responseTimeMs = Date.now() - started;
        void this.costService.record({
          provider: response.provider,
          model: response.model,
          task: request.task,
          promptTokens: response.usage?.promptTokens,
          completionTokens: response.usage?.completionTokens,
          totalTokens: response.usage?.totalTokens,
          prompt: promptText,
          response: response.content,
          responseTimeMs,
          retryCount: attempt,
          success: true,
          metadata: {
            ...(request.metadata ?? {}),
            temperature: request.temperature ?? null,
            maxTokens: request.maxTokens ?? null,
          },
        });
        return response;
      } catch (error) {
        lastError = error;
        const responseTimeMs = Date.now() - started;
        const message =
          error instanceof Error ? error.message : String(error);
        const retryable = this.isRetryable(error);
        const willRetry = retryable && attempt < maxRetries;

        if (!willRetry) {
          void this.costService.record({
            provider: this.provider.name,
            model: request.model || 'unknown',
            task: request.task,
            prompt: promptText,
            responseTimeMs,
            retryCount: attempt,
            success: false,
            errorMessage: message,
            metadata: request.metadata ?? null,
          });
          throw error;
        }

        this.logger.warn(
          `AI complete retry task=${request.task} attempt=${attempt + 1}/${maxRetries} err=${message}`,
        );
        attempt += 1;
        if (retryDelayMs > 0) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AiEngineError('AI complete failed', 'PROVIDER_ERROR');
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof AiEngineError) {
      return (
        error.code === 'RATE_LIMITED' ||
        error.code === 'PROVIDER_UNAVAILABLE'
      );
    }

    if (error instanceof Error) {
      const cause = (error as any).cause as Record<string, unknown> | undefined;
      if (cause && typeof cause === 'object') {
        const status = (cause as { status?: number }).status;
        if (typeof status === 'number') {
          if (status === 429 || status >= 500) return true;
          if (status >= 400 && status < 500) return false;
        }
      }

      const networkCodes = [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
      ];
      const errCode = (error as NodeJS.ErrnoException).code;
      if (errCode && networkCodes.includes(errCode)) return true;

      if (error.name === 'AbortError') return true;
    }

    return false;
  }

  /**
   * AI Keyword Generator
   * 입력: 브랜드·상품명·모델명·옵션·색상
   * 출력: 검색어 배열 (중복 제거, 최대 20개)
   */
  async generateKeywords(input: AiKeywordInput): Promise<AiKeywordResult> {
    const prompt = this.promptManager.render(
      'keyword',
      buildKeywordPromptVars(input),
    );
    const response = await this.complete({
      task: 'keyword',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.3,
      maxTokens: 1024,
      metadata: { pipeline: 'keyword', promptVersion: prompt.version },
    });

    const keywords = normalizeKeywords(parseKeywordsJson(response.content));
    this.logger.log(
      `AI keywords generated count=${keywords.length} provider=${response.provider}`,
    );
    return { keywords, raw: response.content };
  }

  /**
   * AI Matching Engine — 렌탈 상품 vs 검색 결과 1건
   * Matching Logic (항목 점수 · AI Score) 은 이 메서드에서 수행
   */
  async matchListing(input: AiMatchingInput): Promise<AiMatchingResult> {
    let ocrAnalysis: AiOcrResult | null = null;
    const ocrBeforeMatch = this.config.get<boolean>('ai.ocrBeforeMatch') === true;

    if (ocrBeforeMatch && input.listing.ocrText?.trim()) {
      try {
        ocrAnalysis = await this.analyzeOcr({
          rawText: input.listing.ocrText,
          siteCode: input.listing.siteCode ?? undefined,
        });
      } catch (err) {
        this.logger.warn(
          `OCR pre-analysis failed (ignored): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const prompt = this.promptManager.render(
      'matching',
      buildMatchingPromptVars({
        rental: input.rental,
        listing: input.listing,
        ocrAnalysis,
      }),
    );
    const response = await this.complete({
      task: 'matching',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.1,
      maxTokens: 1024,
      metadata: {
        pipeline: 'matching',
        listingId: input.listing.id,
        promptVersion: prompt.version,
      },
    });

    const parsed = parseMatchingJson(response.content);
    let scores = normalizeItemScores(parsed.scores);
    let matchingScore = clampScore(
      parsed.matchingScore ?? weightedAverage(scores),
    );
    let aiScore = clampScore(
      parsed.aiScore ?? computeAiScoreFromItems(scores, matchingScore),
    );
    let reason =
      typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim()
        : 'AI Matching 평가 완료';

    const visionBeforeMatch =
      this.config.get<boolean>('ai.visionBeforeMatch') !== false;
    if (
      visionBeforeMatch &&
      shouldRunVisionCompare({
        matchingScore,
        scores,
        rentalImageUrl: input.rental.imageUrl,
        listingImageUrl: input.listing.imageUrl,
      })
    ) {
      try {
        const rentalImageUrl = String(input.rental.imageUrl);
        const listingImageUrl = String(input.listing.imageUrl);

        // LooksSame + OpenCV 로컬 게이트 → threshold 미통과면 Vision 스킵 (비용 절감)
        let allowVision = true;
        if (this.matchingLocalImage.isEnabled()) {
          const localGate = await this.matchingLocalImage.evaluate({
            rentalImageUrl,
            listingImageUrl,
          });
          if (localGate && !localGate.shouldCallVision) {
            allowVision = false;
            const adjusted = applyLocalToMatching({
              scores,
              matchingScore,
              aiScore,
              reason,
              localSimilarity: localGate.localSimilarity,
              localReason: localGate.reason,
            });
            scores = adjusted.scores;
            matchingScore = adjusted.matchingScore;
            aiScore = adjusted.aiScore;
            reason = adjusted.reason;
            this.logger.debug(
              `AI match local gate blocked Vision listingId=${input.listing.id ?? '-'}` +
                ` local=${localGate.localSimilarity} matching=${matchingScore} ai=${aiScore}`,
            );
          } else if (localGate?.shouldCallVision) {
            this.logger.debug(
              `AI match local gate passed listingId=${input.listing.id ?? '-'} — ${localGate.reason}`,
            );
          }
        }

        if (allowVision && this.canCompareImages()) {
          const productHint = [
            input.rental.brand,
            input.rental.productName,
            input.rental.modelName,
          ]
            .filter(Boolean)
            .join(' ');
          const vision = await this.compareImages({
            rentalImageUrl,
            listingImageUrl,
            productHint: productHint || null,
            metadata: {
              listingId: input.listing.id,
              pipeline: 'matching',
            },
          });
          const adjusted = applyVisionToMatching({
            scores,
            matchingScore,
            aiScore,
            reason,
            visionSimilarity: vision.imageSimilarity,
            visionReason: vision.reason,
          });
          scores = adjusted.scores;
          matchingScore = adjusted.matchingScore;
          aiScore = adjusted.aiScore;
          reason = adjusted.reason;
          this.logger.debug(
            `AI match vision applied listingId=${input.listing.id ?? '-'} vision=${vision.imageSimilarity} matching=${matchingScore} ai=${aiScore}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Vision/local image compare skipped (matching continues): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.debug(
      `AI match listingId=${input.listing.id ?? '-'} matching=${matchingScore} ai=${aiScore}`,
    );

    return {
      matchingScore,
      aiScore,
      reason,
      scores,
      raw: response.content,
      listingId: input.listing.id,
    };
  }

  /**
   * 검색 결과 목록에 Matching Engine 적용.
   * 1차: title/imageSimilarity 상위 N LLM
   * 2차: 미포함 후보 중 로컬 이미지(또는 title)로 선별한 상위 K LLM
   */
  async matchSearchResults(params: {
    rental: AiRentalProduct;
    listings: AiListingCandidate[];
    limit?: number;
    secondPassLimit?: number;
  }): Promise<AiMatchingResult[]> {
    const configuredLimit = this.config.get<number>('ai.matchBatchLimit');
    const limit = Math.min(
      Math.max(
        params.limit ??
          (Number.isFinite(configuredLimit)
            ? Number(configuredLimit)
            : MATCH_BATCH_LIMIT_DEFAULT),
        1,
      ),
      50,
    );
    const configuredSecond = this.config.get<number>('ai.matchSecondPassLimit');
    const secondPassLimit = Math.min(
      Math.max(
        params.secondPassLimit ??
          (Number.isFinite(configuredSecond) ? Number(configuredSecond) : 10),
        0,
      ),
      20,
    );
    const minTitleRaw = this.config.get<number>('ai.matchSecondPassMinTitle');
    const minTitle = Number.isFinite(minTitleRaw) ? Number(minTitleRaw) : 0.2;

    const sorted = [...params.listings].sort((a, b) => {
      const sa = Math.max(a.titleSimilarity ?? 0, a.imageSimilarity ?? 0);
      const sb = Math.max(b.titleSimilarity ?? 0, b.imageSimilarity ?? 0);
      return sb - sa;
    });
    const pass1Targets = sorted.slice(0, limit);
    const results = await this.matchListingsBatch(params.rental, pass1Targets);

    const matchedIds = new Set(
      results.map((r) => r.listingId).filter((id): id is string => !!id),
    );
    const remaining = sorted.filter((l) => l.id && !matchedIds.has(l.id));

    let pass2Targets: AiListingCandidate[] = [];
    if (secondPassLimit > 0 && remaining.length > 0) {
      pass2Targets = await this.selectSecondPassTargets({
        rental: params.rental,
        remaining,
        secondPassLimit,
        minTitle,
      });
      if (pass2Targets.length > 0) {
        const pass2 = await this.matchListingsBatch(
          params.rental,
          pass2Targets,
        );
        results.push(...pass2);
      }
    }

    this.logger.log(
      `AI Matching Engine done matched=${results.length} pass1=${pass1Targets.length} pass2=${pass2Targets.length}`,
    );
    return results;
  }

  private async matchListingsBatch(
    rental: AiRentalProduct,
    targets: AiListingCandidate[],
  ): Promise<AiMatchingResult[]> {
    const results: AiMatchingResult[] = [];
    for (let i = 0; i < targets.length; i += MATCH_CONCURRENCY) {
      const chunk = targets.slice(i, i + MATCH_CONCURRENCY);
      const settled = await Promise.allSettled(
        chunk.map((listing) => this.matchListing({ rental, listing })),
      );
      for (const item of settled) {
        if (item.status === 'fulfilled') {
          results.push(item.value);
        } else {
          this.logger.warn(
            `AI matching failed: ${
              item.reason instanceof Error
                ? item.reason.message
                : String(item.reason)
            }`,
          );
        }
      }
    }
    return results;
  }

  /**
   * 2차 패스 후보 선별.
   * 로컬 이미지 게이트 사용 가능하면 localSimilarity 상위 K,
   * 아니면 titleSimilarity 상위 K.
   */
  private async selectSecondPassTargets(params: {
    rental: AiRentalProduct;
    remaining: AiListingCandidate[];
    secondPassLimit: number;
    minTitle: number;
  }): Promise<AiListingCandidate[]> {
    const pool = params.remaining
      .filter((l) => (l.titleSimilarity ?? 0) >= params.minTitle)
      .slice(0, 40);

    if (pool.length === 0) return [];

    const rentalImage = params.rental.imageUrl?.trim();
    if (
      rentalImage &&
      this.matchingLocalImage.isEnabled()
    ) {
      type Scored = { listing: AiListingCandidate; localSim: number };
      const scored: Scored[] = [];
      for (let i = 0; i < pool.length; i += 4) {
        const chunk = pool.slice(i, i + 4);
        const settled = await Promise.allSettled(
          chunk.map(async (listing) => {
            const listingImage = listing.imageUrl?.trim();
            if (!listingImage) {
              return {
                listing,
                localSim: (listing.titleSimilarity ?? 0) * 100,
              };
            }
            const gate = await this.matchingLocalImage.evaluate({
              rentalImageUrl: rentalImage,
              listingImageUrl: listingImage,
            });
            const localSim =
              gate?.localSimilarity ??
              (listing.titleSimilarity ?? 0) * 100;
            return { listing, localSim };
          }),
        );
        for (const item of settled) {
          if (item.status === 'fulfilled') scored.push(item.value);
        }
      }
      scored.sort((a, b) => b.localSim - a.localSim);
      return scored
        .slice(0, params.secondPassLimit)
        .map((s) => s.listing);
    }

    return pool.slice(0, params.secondPassLimit);
  }

  /**
   * Investigation Analysis
   * 렌탈 상품 · 검색 결과 · Matching · OCR · 이미지 → Summary / 근거 / 추천 (Plain text)
   */
  async analyzeInvestigation(
    input: AiInvestigationInput,
  ): Promise<AiInvestigationResult> {
    const listing: AiListingCandidate = {
      ...input.listing,
      title:
        input.listing?.title ||
        input.listingTitle ||
        input.productName ||
        '',
      siteCode: input.listing?.siteCode ?? input.siteCode ?? null,
      imageUrl: input.listing?.imageUrl ?? input.imageUrl ?? null,
      ocrText: input.listing?.ocrText ?? input.ocrText ?? null,
      titleSimilarity: input.listing?.titleSimilarity ?? input.titleSimilarity,
      imageSimilarity: input.listing?.imageSimilarity ?? input.imageSimilarity,
    };

    if (!listing.title.trim()) {
      throw new AiEngineError(
        'Investigation Analysis 에 listing.title 이 필요합니다.',
        'INVALID_REQUEST',
      );
    }

    const prompt = this.promptManager.render(
      'investigation',
      buildInvestigationPromptVars({
        ...input,
        listing,
        rental: input.rental ?? {
          productName: input.productName,
          imageUrl: input.imageUrl,
          ocrText: input.ocrText,
        },
      }),
    );

    const response = await this.complete({
      task: 'investigation',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.2,
      maxTokens: 1024,
      metadata: {
        pipeline: 'investigation',
        promptVersion: prompt.version,
      },
    });

    const parsed = parseInvestigationJson(response.content);
    const summary = toPlainText(parsed.summary) || '조사 요약을 생성하지 못했습니다.';
    const reasons = (parsed.reasons ?? [])
      .map((r) => toPlainText(r))
      .filter((r) => r.length > 0);
    const riskLevel = normalizeRiskLevel(parsed.riskLevel);

    this.logger.log(
      `AI Investigation Analysis risk=${riskLevel} reasons=${reasons.length}`,
    );

    return {
      summary,
      reasons,
      riskLevel,
      raw: response.content,
    };
  }

  /**
   * AI Recommendation — Investigation Summary 와 분리
   * stars · headline · actions · reasons (Plain text)
   */
  async generateRecommendation(input: {
    orderNo?: string | null;
    rental?: AiRentalProduct | null;
    listing: AiListingCandidate;
    matching?: AiMatchingResult | null;
    investigationSummary?: string | null;
    judgmentReasons?: string[] | null;
  }): Promise<AiRecommendationResult> {
    const prompt = this.promptManager.render(
      'recommendation',
      buildRecommendationPromptVars({
        orderNo: input.orderNo,
        rental: input.rental,
        listing: input.listing,
        matching: input.matching
          ? {
              matchingScore: input.matching.matchingScore,
              aiScore: input.matching.aiScore,
              reason: input.matching.reason,
              scores: input.matching.scores,
            }
          : null,
        investigationSummary: input.investigationSummary,
        judgmentReasons: input.judgmentReasons,
      }),
    );

    const response = await this.complete({
      task: 'recommendation',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.2,
      maxTokens: 800,
      metadata: {
        pipeline: 'recommendation',
        promptVersion: prompt.version,
      },
    });

    const parsed = parseRecommendationJson(response.content);
    const stars = clampStars(parsed.stars);
    const headline =
      toPlainText(parsed.headline) ||
      defaultHeadline(stars);
    const actions = (parsed.actions ?? [])
      .map((a) => toPlainText(a))
      .filter(Boolean);
    const reasons = (parsed.reasons ?? [])
      .map((r) => toPlainText(r))
      .filter(Boolean);

    const result: AiRecommendationResult = {
      stars,
      headline,
      actions:
        actions.length > 0
          ? actions.slice(0, 8)
          : ['증거 저장', '담당자 지정', '추가 조사'],
      reasons:
        reasons.length > 0
          ? reasons.slice(0, 8)
          : ['AI Matching 결과를 바탕으로 추가 조치가 권장됩니다.'],
      raw: response.content,
    };

    this.logger.log(
      `AI Recommendation stars=${result.stars} actions=${result.actions.length}`,
    );
    return result;
  }

  canAnalyzeInvestigation(): boolean {
    return this.isEnabled() && this.provider.isConfigured() && this.provider.isImplemented();
  }

  /** Vision Image Analysis 사용 가능 (실제 구현 provider 만 true) */
  canCompareImages(): boolean {
    return this.isEnabled() && this.visionProvider.isConfigured() && this.visionProvider.isImplemented();
  }

  /**
   * Image Analysis (Vision)
   * 렌탈 이미지 vs 검색 결과 이미지 → Image Similarity 0~100
   * CDN 차단 대비: 가능하면 서버에서 받아 data URL로 전달
   */
  async compareImages(
    input: AiImageCompareRequest,
  ): Promise<AiImageCompareResponse> {
    if (!this.isEnabled()) {
      throw new AiEngineError(
        'AI Engine is disabled (AI_ENABLED=false).',
        'PROVIDER_UNAVAILABLE',
      );
    }
    if (!this.visionProvider.isConfigured()) {
      throw new AiEngineError(
        `Vision Provider "${this.visionProvider.name}" is not configured.`,
        'PROVIDER_UNAVAILABLE',
      );
    }
    if (!input.rentalImageUrl?.trim() || !input.listingImageUrl?.trim()) {
      throw new AiEngineError(
        'rentalImageUrl 과 listingImageUrl 이 필요합니다.',
        'INVALID_REQUEST',
      );
    }

    const resolved = await this.resolveVisionImageUrls(input);

    const prompt = this.promptManager.render(
      'image',
      buildImagePromptVars({
        rentalImageUrl: input.rentalImageUrl,
        listingImageUrl: input.listingImageUrl,
        productHint: input.productHint,
      }),
    );
    const promptText = `${prompt.system}\n\n${prompt.user}`;

    const maxRetries = Math.max(
      0,
      this.config.get<number>('ai.maxRetries') ?? 2,
    );
    const retryDelayMs = Math.max(
      0,
      this.config.get<number>('ai.retryDelayMs') ?? 500,
    );

    this.logger.debug(
      `AI Vision compare provider=${this.visionProvider.name} prompt=v${prompt.version} maxRetries=${maxRetries}`,
    );

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      const started = Date.now();
      try {
        const result = await this.visionProvider.compareImages(resolved, {
          systemPrompt: prompt.system,
          userPrompt: prompt.user,
        });
        void this.costService.record({
          provider: result.provider,
          model: result.model || 'vision',
          task: 'image',
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens,
          prompt: promptText,
          response: result.reason,
          responseTimeMs: Date.now() - started,
          retryCount: attempt,
          success: true,
          metadata: {
            pipeline: 'image',
            promptVersion: prompt.version,
            imageSimilarity: result.imageSimilarity,
          },
        });
        return result;
      } catch (error) {
        lastError = error;
        const responseTimeMs = Date.now() - started;
        const message =
          error instanceof Error ? error.message : String(error);
        const retryable = this.isRetryable(error);
        const willRetry = retryable && attempt < maxRetries;

        if (!willRetry) {
          void this.costService.record({
            provider: this.visionProvider.name,
            model: input.model || 'vision',
            task: 'image',
            prompt: promptText,
            responseTimeMs,
            retryCount: attempt,
            success: false,
            errorMessage: message,
            metadata: { pipeline: 'image', promptVersion: prompt.version },
          });
          throw error;
        }

        this.logger.warn(
          `AI Vision compare retry attempt=${attempt + 1}/${maxRetries} err=${message}`,
        );
        attempt += 1;
        if (retryDelayMs > 0) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AiEngineError('AI Vision compare failed', 'PROVIDER_ERROR');
  }

  /** Vision용 이미지 URL → 가능하면 data URL (CDN 핫링크 차단 회피) */
  private async resolveVisionImageUrls(
    input: AiImageCompareRequest,
  ): Promise<AiImageCompareRequest> {
    const [rentalData, listingData] = await Promise.all([
      this.imageStorage.fetchAsDataUrl(input.rentalImageUrl),
      this.imageStorage.fetchAsDataUrl(input.listingImageUrl),
    ]);
    return {
      ...input,
      rentalImageUrl: rentalData || input.rentalImageUrl,
      listingImageUrl: listingData || input.listingImageUrl,
    };
  }

  /** OCR Analysis 사용 가능 */
  canAnalyzeOcr(): boolean {
    return this.isEnabled() && this.provider.isConfigured() && this.provider.isImplemented();
  }

  /**
   * OCR Analysis
   * OCR 원문 → 정규화 + 필드 추출 (상품명·가격·지역·판매자·연락처·설명)
   * 예: 뷰티레스트킹 → 뷰티레스트 King
   */
  async analyzeOcr(input: AiOcrInput): Promise<AiOcrResult> {
    if (!input.rawText?.trim()) {
      throw new AiEngineError(
        'OCR rawText 가 필요합니다.',
        'INVALID_REQUEST',
      );
    }

    const prompt = this.promptManager.render(
      'ocr',
      buildOcrPromptVars(input),
    );
    const response = await this.complete({
      task: 'ocr',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.1,
      maxTokens: 1536,
      metadata: {
        pipeline: 'ocr',
        siteCode: input.siteCode ?? null,
        promptVersion: prompt.version,
      },
    });

    const parsed = parseOcrJson(response.content);
    const fields = normalizeOcrFields(parsed.fields);
    const result: AiOcrResult = {
      normalizedText:
        parsed.normalizedText?.trim() ||
        fields.productName ||
        input.rawText.trim(),
      fields,
      normalizations: parsed.normalizations,
      raw: response.content,
    };

    this.logger.log(
      `AI OCR analyzed product=${fields.productName ?? '-'} norms=${result.normalizations.length}`,
    );
    return result;
  }

  /** Report Generator 사용 가능 */
  canGenerateReport(): boolean {
    return this.isEnabled() && this.provider.isConfigured() && this.provider.isImplemented();
  }

  /** AI Health 상태 반환 */
  getHealthStatus() {
    return {
      enabled: this.isEnabled(),
      provider: {
        name: this.provider.name,
        configured: this.provider.isConfigured(),
        implemented: this.provider.isImplemented(),
      },
      visionProvider: {
        name: this.visionProvider.name,
        configured: this.visionProvider.isConfigured(),
        implemented: this.visionProvider.isImplemented(),
      },
      capabilities: {
        match: this.canMatch(),
        investigate: this.canAnalyzeInvestigation(),
        vision: this.canCompareImages(),
      },
    };
  }

  /**
   * Investigation Report Generator
   * 출력: JSON Document + PDF-ready HTML
   * 섹션: Summary / AI Score / Evidence / Timeline / Recommendation / Final Decision
   */
  async generateReport(input: AiReportInput): Promise<AiReportResult> {
    const prompt = this.promptManager.render(
      'report',
      buildReportPromptVars(input),
    );
    const response = await this.complete({
      task: 'report',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.2,
      maxTokens: 3072,
      metadata: {
        pipeline: 'report',
        orderNo: input.orderNo ?? null,
        investigationCaseNo: input.investigationCaseNo ?? null,
        promptVersion: prompt.version,
      },
    });

    const parsed = parseReportJson(response.content);
    const doc = buildReportDocument(input, parsed);
    const html = renderReportHtml(doc);

    this.logger.log(
      `AI Report generated title="${doc.title}" aiScore=${doc.aiScore} suggested=${doc.suggestedDecision.code}`,
    );

    return {
      json: doc,
      html,
      title: doc.title,
      summary: doc.summary,
      aiScore: doc.aiScore,
      raw: response.content,
    };
  }
}

function parseKeywordsJson(content: string): string[] {
  const cleaned = stripJsonFence(content);

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string');
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const list = obj.keywords ?? obj.keyword ?? obj.searchKeywords;
      if (Array.isArray(list)) {
        return list.filter((x): x is string => typeof x === 'string');
      }
    }
  } catch {
    // fall through
  }

  throw new AiEngineError(
    `Keyword JSON 파싱 실패: ${cleaned.slice(0, 200)}`,
    'INVALID_REQUEST',
  );
}

function parseMatchingJson(content: string): {
  matchingScore?: number;
  aiScore?: number;
  reason?: string;
  scores?: Partial<AiMatchingItemScores>;
} {
  const cleaned = stripJsonFence(content);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const scoresRaw =
      parsed.scores && typeof parsed.scores === 'object'
        ? (parsed.scores as Record<string, unknown>)
        : {};
    return {
      matchingScore: toNumber(parsed.matchingScore ?? parsed.score),
      aiScore: toNumber(parsed.aiScore ?? parsed.finalScore),
      reason:
        typeof parsed.reason === 'string'
          ? parsed.reason
          : typeof parsed.judgment === 'string'
            ? parsed.judgment
            : undefined,
      scores: {
        brand: toNumber(scoresRaw.brand),
        model: toNumber(scoresRaw.model ?? scoresRaw.modelName),
        productName: toNumber(
          scoresRaw.productName ?? scoresRaw.title ?? scoresRaw.name,
        ),
        price: toNumber(scoresRaw.price),
        option: toNumber(scoresRaw.option),
        color: toNumber(scoresRaw.color),
        image: toNumber(scoresRaw.image ?? scoresRaw.imageSimilarity),
        description: toNumber(scoresRaw.description),
        ocr: toNumber(scoresRaw.ocr ?? scoresRaw.ocrMatch),
      },
    };
  } catch {
    throw new AiEngineError(
      `Matching JSON 파싱 실패: ${cleaned.slice(0, 200)}`,
      'INVALID_REQUEST',
    );
  }
}

function parseInvestigationJson(content: string): {
  summary?: string;
  reasons?: string[];
  riskLevel?: string;
} {
  const cleaned = stripJsonFence(content);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const reasonsRaw = parsed.reasons ?? parsed.judgmentReasons ?? parsed.grounds;
    const reasons = Array.isArray(reasonsRaw)
      ? reasonsRaw.filter((x): x is string => typeof x === 'string')
      : typeof reasonsRaw === 'string'
        ? [reasonsRaw]
        : [];

    return {
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : typeof parsed.investigationSummary === 'string'
            ? parsed.investigationSummary
            : undefined,
      reasons,
      riskLevel:
        typeof parsed.riskLevel === 'string'
          ? parsed.riskLevel
          : typeof parsed.risk === 'string'
            ? parsed.risk
            : undefined,
    };
  } catch {
    throw new AiEngineError(
      `Investigation JSON 파싱 실패: ${cleaned.slice(0, 200)}`,
      'INVALID_REQUEST',
    );
  }
}

function parseRecommendationJson(content: string): {
  stars?: number;
  headline?: string;
  actions?: string[];
  reasons?: string[];
} {
  const cleaned = stripJsonFence(content);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const actionsRaw = parsed.actions ?? parsed.recommendations;
    const reasonsRaw = parsed.reasons ?? parsed.recommendationReasons;
    return {
      stars: toNumber(parsed.stars ?? parsed.rating ?? parsed.score),
      headline:
        typeof parsed.headline === 'string'
          ? parsed.headline
          : typeof parsed.message === 'string'
            ? parsed.message
            : typeof parsed.summary === 'string'
              ? parsed.summary
              : undefined,
      actions: Array.isArray(actionsRaw)
        ? actionsRaw.filter((x): x is string => typeof x === 'string')
        : [],
      reasons: Array.isArray(reasonsRaw)
        ? reasonsRaw.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    throw new AiEngineError(
      `Recommendation JSON 파싱 실패: ${cleaned.slice(0, 200)}`,
      'INVALID_REQUEST',
    );
  }
}

function parseOcrJson(content: string): {
  normalizedText?: string;
  fields?: Partial<AiOcrFields>;
  normalizations: Array<{ from: string; to: string }>;
} {
  const cleaned = stripJsonFence(content);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const fieldsRaw =
      parsed.fields && typeof parsed.fields === 'object'
        ? (parsed.fields as Record<string, unknown>)
        : parsed;
    const normsRaw = parsed.normalizations ?? parsed.corrections ?? [];
    const normalizations = Array.isArray(normsRaw)
      ? normsRaw
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const row = item as Record<string, unknown>;
            const from =
              typeof row.from === 'string'
                ? row.from
                : typeof row.original === 'string'
                  ? row.original
                  : null;
            const to =
              typeof row.to === 'string'
                ? row.to
                : typeof row.normalized === 'string'
                  ? row.normalized
                  : null;
            if (!from || !to) return null;
            return { from: from.trim(), to: to.trim() };
          })
          .filter((x): x is { from: string; to: string } => x != null)
      : [];

    return {
      normalizedText:
        typeof parsed.normalizedText === 'string'
          ? parsed.normalizedText
          : typeof parsed.normalized === 'string'
            ? parsed.normalized
            : undefined,
      fields: {
        productName: nullableString(
          fieldsRaw.productName ?? fieldsRaw.name ?? fieldsRaw.title,
        ),
        price: nullableString(fieldsRaw.price),
        region: nullableString(
          fieldsRaw.region ?? fieldsRaw.location ?? fieldsRaw.area,
        ),
        seller: nullableString(
          fieldsRaw.seller ?? fieldsRaw.sellerName ?? fieldsRaw.nickname,
        ),
        contact: nullableString(
          fieldsRaw.contact ?? fieldsRaw.phone ?? fieldsRaw.tel,
        ),
        description: nullableString(
          fieldsRaw.description ?? fieldsRaw.body ?? fieldsRaw.content,
        ),
      },
      normalizations,
    };
  } catch {
    throw new AiEngineError(
      `OCR JSON 파싱 실패: ${cleaned.slice(0, 200)}`,
      'INVALID_REQUEST',
    );
  }
}

function normalizeOcrFields(partial?: Partial<AiOcrFields>): AiOcrFields {
  return {
    productName: nullableString(partial?.productName),
    price: nullableString(partial?.price),
    region: nullableString(partial?.region),
    seller: nullableString(partial?.seller),
    contact: nullableString(partial?.contact),
    description: nullableString(partial?.description),
  };
}

function nullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t || t.toLowerCase() === 'null' || t === '-') return null;
  return t;
}

function parseReportJson(content: string): {
  title?: string;
  summary?: string;
  aiScore?: number;
  matchingScore?: number | null;
  evidence?: AiReportEvidenceItem[];
  timeline?: AiReportTimelineItem[];
  recommendation?: {
    stars?: number | null;
    headline?: string;
    actions?: string[];
    reasons?: string[];
  };
  suggestedDecision?: {
    code?: string;
    label?: string;
    rationale?: string;
  };
} {
  const cleaned = stripJsonFence(content);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const recRaw =
      parsed.recommendation && typeof parsed.recommendation === 'object'
        ? (parsed.recommendation as Record<string, unknown>)
        : {};
    const sdSource =
      parsed.suggestedDecision ?? parsed.finalDecision ?? null;
    const sdRaw =
      sdSource && typeof sdSource === 'object'
        ? (sdSource as Record<string, unknown>)
        : typeof sdSource === 'string'
          ? { code: sdSource }
          : {};

    return {
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : typeof parsed.body === 'string'
            ? parsed.body
            : undefined,
      aiScore: toNumber(parsed.aiScore ?? parsed.score),
      matchingScore: toNumber(parsed.matchingScore),
      evidence: parseEvidenceList(parsed.evidence),
      timeline: parseTimelineList(parsed.timeline),
      recommendation: {
        stars: toNumber(recRaw.stars ?? recRaw.rating),
        headline:
          typeof recRaw.headline === 'string'
            ? recRaw.headline
            : typeof recRaw.message === 'string'
              ? recRaw.message
              : undefined,
        actions: Array.isArray(recRaw.actions)
          ? recRaw.actions.filter((x): x is string => typeof x === 'string')
          : [],
        reasons: Array.isArray(recRaw.reasons)
          ? recRaw.reasons.filter((x): x is string => typeof x === 'string')
          : [],
      },
      suggestedDecision: {
        code:
          typeof sdRaw.code === 'string'
            ? sdRaw.code
            : typeof sdRaw.decision === 'string'
              ? sdRaw.decision
              : undefined,
        label: typeof sdRaw.label === 'string' ? sdRaw.label : undefined,
        rationale:
          typeof sdRaw.rationale === 'string'
            ? sdRaw.rationale
            : typeof sdRaw.reason === 'string'
              ? sdRaw.reason
              : undefined,
      },
    };
  } catch {
    throw new AiEngineError(
      `Report JSON 파싱 실패: ${cleaned.slice(0, 200)}`,
      'INVALID_REQUEST',
    );
  }
}

function parseEvidenceList(value: unknown): AiReportEvidenceItem[] {
  if (!Array.isArray(value)) return [];
  const items: AiReportEvidenceItem[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const title = item.trim();
      if (title) items.push({ title });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title =
      typeof row.title === 'string'
        ? row.title.trim()
        : typeof row.name === 'string'
          ? row.name.trim()
          : '';
    if (!title) continue;
    items.push({
      title,
      detail: nullableString(row.detail ?? row.description),
      url: nullableString(row.url),
      kind: nullableString(row.kind ?? row.type),
    });
  }
  return items;
}

function parseTimelineList(value: unknown): AiReportTimelineItem[] {
  if (!Array.isArray(value)) return [];
  const items: AiReportTimelineItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title =
      typeof row.title === 'string'
        ? row.title.trim()
        : typeof row.event === 'string'
          ? row.event.trim()
          : '';
    if (!title) continue;
    const at =
      typeof row.at === 'string'
        ? row.at
        : typeof row.time === 'string'
          ? row.time
          : typeof row.createdAt === 'string'
            ? row.createdAt
            : new Date().toISOString();
    items.push({
      at,
      title,
      detail: nullableString(row.detail ?? row.description),
      kind: nullableString(row.kind ?? row.type),
    });
  }
  return items;
}

function buildReportDocument(
  input: AiReportInput,
  parsed: ReturnType<typeof parseReportJson>,
): AiReportDocument {
  const aiScore = clampScore(
    parsed.aiScore ?? input.aiScore ?? 0,
  );
  const matchingScore =
    parsed.matchingScore ?? input.matchingScore ?? null;
  const evidence =
    (parsed.evidence && parsed.evidence.length > 0
      ? parsed.evidence
      : input.evidence) ?? [];
  const timeline =
    (parsed.timeline && parsed.timeline.length > 0
      ? parsed.timeline
      : input.timeline) ?? [];

  const inputRec = input.recommendation;
  const starsRaw =
    parsed.recommendation?.stars ?? inputRec?.stars ?? null;
  const stars =
    starsRaw != null && Number.isFinite(starsRaw)
      ? Math.max(1, Math.min(5, Math.round(starsRaw)))
      : null;

  const decisionCode =
    parsed.suggestedDecision?.code || 'pending';
  const decisionLabel =
    parsed.suggestedDecision?.label ||
    decisionLabelOf(decisionCode);
  const decisionRationale =
    toPlainText(parsed.suggestedDecision?.rationale || '') ||
    'AI 제안 근거가 충분하지 않습니다.';

  const humanCode =
    input.humanFinalDecision ?? input.finalDecision ?? null;
  const humanFinalDecision = humanCode
    ? {
        code: humanCode,
        label: decisionLabelOf(String(humanCode)),
        rationale:
          toPlainText(
            input.humanFinalDecisionRationale ||
              input.finalDecisionRationale ||
              '',
          ) || '사람 확정 판정',
      }
    : null;

  const summary =
    toPlainText(parsed.summary) ||
    toPlainText(input.summary) ||
    (input.findings?.length
      ? toPlainText(input.findings.join(' '))
      : '조사 요약이 없습니다.');

  const title =
    toPlainText(parsed.title) ||
    `Investigation Report${
      input.investigationCaseNo
        ? ` — ${input.investigationCaseNo}`
        : input.orderNo
          ? ` — ${input.orderNo}`
          : ''
    }`;

  return {
    title,
    generatedAt: new Date().toISOString(),
    meta: {
      orderNo: input.orderNo ?? null,
      investigationCaseNo: input.investigationCaseNo ?? null,
      siteCode:
        input.siteCode ?? input.listing?.siteCode ?? null,
      productName:
        input.productName ?? input.rental?.productName ?? null,
      listingTitle:
        input.listingTitle ?? input.listing?.title ?? null,
    },
    summary,
    aiScore,
    matchingScore:
      matchingScore != null && Number.isFinite(matchingScore)
        ? clampScore(matchingScore)
        : null,
    evidence,
    timeline,
    recommendation: {
      stars,
      headline:
        toPlainText(parsed.recommendation?.headline) ||
        toPlainText(inputRec?.headline) ||
        defaultHeadline(stars ?? 3),
      actions:
        (parsed.recommendation?.actions?.length
          ? parsed.recommendation.actions
          : inputRec?.actions
        )?.map((a) => toPlainText(a)).filter(Boolean) ?? [],
      reasons:
        (parsed.recommendation?.reasons?.length
          ? parsed.recommendation.reasons
          : inputRec?.reasons
        )?.map((r) => toPlainText(r)).filter(Boolean) ?? [],
    },
    suggestedDecision: {
      code: decisionCode,
      label: decisionLabel,
      rationale: decisionRationale,
    },
    humanFinalDecision,
  };
}

function decisionLabelOf(code: string): string {
  const map: Record<string, string> = {
    resale_confirmed: '재판매 확인',
    further_investigation: '추가 조사',
    false_positive: '오탐',
    excluded: '제외',
    pending: '판정 대기',
  };
  return map[code] ?? code;
}

function clampStars(n?: number): number {
  if (n == null || !Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function defaultHeadline(stars: number): string {
  if (stars >= 5) return '재판매 가능성이 매우 높습니다.';
  if (stars >= 4) return '재판매 가능성이 높습니다.';
  if (stars >= 3) return '추가 확인이 필요합니다.';
  if (stars >= 2) return '재판매 가능성은 보통입니다.';
  return '재판매 가능성은 낮아 보입니다.';
}

/** Markdown 제거 — Plain text only */
function toPlainText(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRiskLevel(
  value?: string,
): 'high' | 'medium' | 'low' {
  const v = (value || '').toLowerCase().trim();
  if (v === 'high' || v === '높음' || v === '상') return 'high';
  if (v === 'low' || v === '낮음' || v === '하') return 'low';
  return 'medium';
}

function normalizeItemScores(
  partial?: Partial<AiMatchingItemScores>,
): AiMatchingItemScores {
  return {
    brand: clampScore(partial?.brand ?? 0),
    model: clampScore(partial?.model ?? 0),
    productName: clampScore(partial?.productName ?? 0),
    price: clampScore(partial?.price ?? 0),
    option: clampScore(partial?.option ?? 0),
    color: clampScore(partial?.color ?? 0),
    image: clampScore(partial?.image ?? 0),
    description: clampScore(partial?.description ?? 0),
    ocr: clampScore(partial?.ocr ?? 0),
  };
}

function weightedAverage(scores: AiMatchingItemScores): number {
  let sum = 0;
  let w = 0;
  for (const key of Object.keys(MATCH_WEIGHTS) as Array<
    keyof AiMatchingItemScores
  >) {
    const weight = MATCH_WEIGHTS[key];
    sum += scores[key] * weight;
    w += weight;
  }
  return w > 0 ? sum / w : 0;
}

/** LLM matchingScore와 항목 가중 평균을 섞어 최종 AI Score */
function computeAiScoreFromItems(
  scores: AiMatchingItemScores,
  matchingScore: number,
): number {
  const itemAvg = weightedAverage(scores);
  return matchingScore * 0.55 + itemAvg * 0.45;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function stripJsonFence(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/** 중복 제거(대소문자 무시) · trim · 최대 KEYWORD_MAX_COUNT */
export function normalizeKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = String(raw ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (v.length < 2) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= KEYWORD_MAX_COUNT) break;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
