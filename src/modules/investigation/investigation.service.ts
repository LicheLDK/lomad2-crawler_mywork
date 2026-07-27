import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { SearchHistory } from '@/database/entities/search-history.entity';
import { SearchHistoryResult } from '@/database/entities/search-history-result.entity';
import { SearchJob } from '@/database/entities/search-job.entity';
import {
  InvestigationAiAnalysis,
  InvestigationCaseEntity,
  InvestigationPriority,
  InvestigationTimelineEvent,
} from '@/database/entities/investigation-case.entity';
import { AiService } from '@/ai/ai.service';
import { AiRuleEngineService } from '@/ai/rules/ai-rule-engine.service';
import type { AiRuleMatch } from '@/ai/rules/ai-rule.types';

export type AutoCreateResult = {
  created: InvestigationCaseEntity[];
  skipped: number;
  excluded: number;
  warned: number;
  threshold: number;
};

@Injectable()
export class InvestigationService {
  private readonly logger = new Logger(InvestigationService.name);

  constructor(
    @InjectRepository(InvestigationCaseEntity)
    private readonly caseRepo: Repository<InvestigationCaseEntity>,
    @InjectRepository(SearchHistoryResult)
    private readonly historyResultRepo: Repository<SearchHistoryResult>,
    @InjectRepository(SearchHistory)
    private readonly historyRepo: Repository<SearchHistory>,
    @InjectRepository(SearchJob)
    private readonly jobRepo: Repository<SearchJob>,
    private readonly config: ConfigService,
    @Optional() private readonly aiService?: AiService,
    @Optional() private readonly ruleEngine?: AiRuleEngineService,
  ) {}

  /**
   * create_investigation Rule 임계값 (DB/Config Rule Engine)
   * Rule Engine 없으면 legacy investigation.aiScoreThreshold
   */
  async getAiScoreThreshold(): Promise<number> {
    if (this.ruleEngine) {
      return this.ruleEngine.getCreateThreshold();
    }
    const raw = this.config.get<number>('investigation.aiScoreThreshold');
    const n = Number.isFinite(raw) ? Number(raw) : 85;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  /** @deprecated sync 호환 — list 등에서 await 없이 쓸 때 */
  getAiScoreThresholdSync(): number {
    const raw = this.config.get<number>('investigation.aiScoreThreshold');
    const n = Number.isFinite(raw) ? Number(raw) : 85;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  isAutoCreateEnabled(): boolean {
    return this.config.get<boolean>('investigation.autoCreateEnabled') !== false;
  }

  /**
   * 검색 완료 후 AI Score >= 기준인 결과로 Investigation 자동 생성.
   * results 를 넘기면 DB 외 캐시(Elastic) 결과도 포함한다.
   */
  async autoCreateFromSearch(params: {
    searchHistoryId: string;
    searchJobId?: string | null;
    /** 렌탈 상품가 (가격 차이 Rule 용) */
    rentalPrice?: string | number | null;
    results?: Array<{
      id: string;
      title: string;
      siteCode: string;
      url: string;
      imageUrl?: string | null;
      price?: string | number | null;
      description?: string | null;
      titleSimilarity?: number | null;
      imageSimilarity?: number | null;
      /** AI Matching Engine — 0~100 */
      matchingScore?: number | null;
      aiScore?: number | null;
      matchingReason?: string | null;
      matchingScores?: {
        brand?: number;
        model?: number;
        productName?: number;
        price?: number;
        option?: number;
        color?: number;
        image?: number;
        description?: number;
        ocr?: number;
      } | null;
    }>;
  }): Promise<AutoCreateResult> {
    if (!this.isAutoCreateEnabled()) {
      return {
        created: [],
        skipped: 0,
        excluded: 0,
        warned: 0,
        threshold: await this.getAiScoreThreshold(),
      };
    }

    const threshold = await this.getAiScoreThreshold();

    const history = await this.historyRepo.findOne({
      where: { id: params.searchHistoryId },
    });
    if (!history) {
      return { created: [], skipped: 0, excluded: 0, warned: 0, threshold };
    }

    let job: SearchJob | null = null;
    if (params.searchJobId) {
      job = await this.jobRepo.findOne({
        where: { id: params.searchJobId },
      });
    } else {
      job = await this.jobRepo.findOne({
        where: { searchHistoryId: params.searchHistoryId },
      });
    }

    const sourceResults =
      params.results && params.results.length > 0
        ? params.results
        : (
            await this.historyResultRepo.find({
              where: { searchHistoryId: params.searchHistoryId },
              relations: ['result'],
              order: { createdAt: 'DESC' },
              take: 200,
            })
          ).map((link) => ({
            id: link.result?.id ?? link.resultId,
            title: link.title,
            siteCode: link.result?.siteCode ?? '',
            url: link.result?.url ?? '',
            imageUrl: link.imageUrl,
            price: link.price,
            titleSimilarity: link.titleSimilarity,
            imageSimilarity: link.imageSimilarity,
            matchingScore: null as number | null,
            aiScore: null as number | null,
            matchingReason: null as string | null,
            matchingScores: null,
          }));

    const created: InvestigationCaseEntity[] = [];
    let skipped = 0;
    let excluded = 0;
    let warned = 0;
    const rentalPrice = parseLoosePrice(params.rentalPrice);

    for (const result of sourceResults) {
      const aiScore01 = this.computeAiScore(result);
      const aiScore100 = Math.round(aiScore01 * 100);

      let ruleWarnings: AiRuleMatch[] = [];
      let shouldCreate = aiScore100 >= threshold;

      if (this.ruleEngine) {
        const evaluation = await this.ruleEngine.evaluate({
          aiScore: aiScore100,
          matchingScore:
            result.matchingScore != null
              ? Number(result.matchingScore)
              : null,
          titleSimilarity: result.titleSimilarity ?? null,
          imageSimilarity: result.imageSimilarity ?? null,
          rentalPrice,
          listingPrice: parseLoosePrice(result.price),
        });

        if (evaluation.exclude) {
          excluded += 1;
          skipped += 1;
          this.logger.debug(
            `Rule exclude result=${result.id} score=${aiScore100} matched=${evaluation.matched
              .map((m) => m.code)
              .join(',')}`,
          );
          continue;
        }

        shouldCreate = evaluation.createInvestigation;
        ruleWarnings = evaluation.warnings;
        if (ruleWarnings.length) warned += 1;
      } else if (aiScore01 < threshold / 100) {
        skipped += 1;
        continue;
      }

      if (!shouldCreate) {
        skipped += 1;
        continue;
      }

      const existing = await this.caseRepo.findOne({
        where: { resultId: result.id },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const caseEntity = await this.createCaseFromResult({
        result,
        aiScore: aiScore01,
        history,
        job,
        autoCreated: true,
        threshold,
        ruleWarnings,
      });
      created.push(caseEntity);
    }

    if (created.length) {
      this.logger.log(
        `Auto-created ${created.length} investigation(s) for search=${params.searchHistoryId} threshold=${threshold} excluded=${excluded} warned=${warned}`,
      );
    }

    return { created, skipped, excluded, warned, threshold };
  }

  async list(limit = 50) {
    const items = await this.caseRepo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
    return {
      total: items.length,
      threshold: await this.getAiScoreThreshold(),
      items: items.map((c) => this.toDto(c)),
    };
  }

  async getOne(id: string) {
    const row = await this.caseRepo.findOne({ where: { id } });
    return row ? this.toDto(row) : null;
  }

  async countBySearchJobId(searchJobId: string): Promise<number> {
    return this.caseRepo.count({ where: { searchJobId } });
  }

  async countBySearchJobIds(
    searchJobIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const unique = [...new Set(searchJobIds.filter(Boolean))];
    if (!unique.length) return map;

    const rows = await this.caseRepo
      .createQueryBuilder('c')
      .select('c.searchJobId', 'searchJobId')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.searchJobId IN (:...ids)', { ids: unique })
      .groupBy('c.searchJobId')
      .getRawMany<{ searchJobId: string; cnt: string }>();

    for (const row of rows) {
      if (row.searchJobId) {
        map.set(row.searchJobId, Number(row.cnt) || 0);
      }
    }
    return map;
  }

  async countByOrderNo(orderNo: string): Promise<number> {
    const trimmed = orderNo.trim();
    if (!trimmed) return 0;
    return this.caseRepo.count({ where: { orderNo: trimmed } });
  }

  async listByOrderNo(orderNo: string, limit = 100) {
    const trimmed = orderNo.trim();
    if (!trimmed) return [];
    const items = await this.caseRepo.find({
      where: { orderNo: trimmed },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return items.map((c) => this.toDto(c));
  }

  async listBySearchJobId(searchJobId: string, limit = 100) {
    const items = await this.caseRepo.find({
      where: { searchJobId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return items.map((c) => this.toDto(c));
  }

  async countByOrderNos(orderNos: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const unique = [...new Set(orderNos.map((o) => o.trim()).filter(Boolean))];
    if (!unique.length) return map;

    const rows = await this.caseRepo
      .createQueryBuilder('c')
      .select('c.orderNo', 'orderNo')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.orderNo IN (:...orderNos)', { orderNos: unique })
      .groupBy('c.orderNo')
      .getRawMany<{ orderNo: string; cnt: string }>();

    for (const row of rows) {
      map.set(row.orderNo, Number(row.cnt) || 0);
    }
    return map;
  }

  private async createCaseFromResult(params: {
    result: {
      id: string;
      title: string;
      siteCode: string;
      url: string;
      imageUrl?: string | null;
      price?: string | number | null;
      description?: string | null;
      titleSimilarity?: number | null;
      imageSimilarity?: number | null;
      matchingScore?: number | null;
      aiScore?: number | null;
      matchingReason?: string | null;
      matchingScores?: {
        brand?: number;
        model?: number;
        productName?: number;
        price?: number;
        option?: number;
        color?: number;
        image?: number;
        description?: number;
        ocr?: number;
      } | null;
    };
    aiScore: number;
    history: SearchHistory;
    job: SearchJob | null;
    autoCreated: boolean;
    threshold: number;
    ruleWarnings?: AiRuleMatch[];
  }): Promise<InvestigationCaseEntity> {
    const {
      result,
      aiScore,
      history,
      job,
      autoCreated,
      threshold,
      ruleWarnings = [],
    } = params;
    const now = new Date();
    const caseNo = await this.nextCaseNumber(now);
    const scorePct = Math.round(aiScore * 100);

    /** Investigation 은 listing + Job 링크만. 주문 마스터는 복제하지 않는다. */
    const orderNo = job?.orderNo?.trim() || null;
    const listingTitle = result.title;

    const timeline: InvestigationTimelineEvent[] = [
      this.tl(
        'search_run',
        minutesBefore(now, 5),
        '검색 완료',
        history.keyword ? `키워드: ${history.keyword}` : null,
      ),
      this.tl(
        'ai_analysis',
        minutesBefore(now, 1),
        'AI Matching 완료',
        result.matchingReason
          ? `AI Score ${scorePct}% · ${result.matchingReason}`
          : `AI Score ${scorePct}%`,
      ),
      this.tl(
        'investigation_created',
        now.toISOString(),
        autoCreated
          ? 'Investigation 자동 생성'
          : 'Investigation 생성',
        autoCreated
          ? `${caseNo} (AI Rule · AI Score ${scorePct}% · threshold ${threshold})`
          : caseNo,
      ),
    ];

    for (const warning of ruleWarnings) {
      timeline.push(
        this.tl(
          'ai_rule_warning',
          now.toISOString(),
          'AI Rule Warning',
          warning.message || `${warning.code}: ${warning.field} ${warning.operator} ${warning.value}`,
        ),
      );
    }

    if (orderNo) {
      timeline.push(
        this.tl(
          'order_mapped',
          now.toISOString(),
          '주문 참조 연결',
          `orderNo=${orderNo}${job?.id ? ` · jobId=${job.id}` : ''}`,
        ),
      );
    }

    // AI Investigation Analysis (Summary · 판단 근거) — Plain text
    // AI Recommendation 은 Summary 와 분리
    let aiOpinion: {
      summary: string;
      reasons: string[];
      riskLevel: string;
    } | null = null;
    let aiRecommendation: {
      stars: number;
      headline: string;
      actions: string[];
      reasons: string[];
    } | null = null;

    if (this.aiService?.canAnalyzeInvestigation()) {
      try {
        const rentalCtx = {
          brand: job?.brand,
          productName: job?.productName,
          modelName: job?.modelName,
          option: job?.option,
          color: job?.color,
          imageUrl: job?.referenceImageUrl,
        };
        const listingCtx = {
          id: result.id,
          title: result.title,
          price: result.price,
          imageUrl: result.imageUrl,
          description: result.description ?? null,
          siteCode: result.siteCode,
          url: result.url,
          titleSimilarity: result.titleSimilarity,
          imageSimilarity: result.imageSimilarity,
        };
        const matchingCtx =
          result.matchingScore != null || result.aiScore != null
            ? {
                matchingScore: result.matchingScore ?? scorePct,
                aiScore: result.aiScore ?? scorePct,
                reason: result.matchingReason ?? '',
                scores: {
                  brand: result.matchingScores?.brand ?? 0,
                  model: result.matchingScores?.model ?? 0,
                  productName: result.matchingScores?.productName ?? 0,
                  price: result.matchingScores?.price ?? 0,
                  option: result.matchingScores?.option ?? 0,
                  color: result.matchingScores?.color ?? 0,
                  image: result.matchingScores?.image ?? 0,
                  description: result.matchingScores?.description ?? 0,
                  ocr: result.matchingScores?.ocr ?? 0,
                },
                listingId: result.id,
              }
            : null;

        const analysis = await this.aiService.analyzeInvestigation({
          orderNo,
          rental: rentalCtx,
          listing: listingCtx,
          matching: matchingCtx,
          ocrText: null,
          imageUrl: result.imageUrl,
        });

        aiOpinion = {
          summary: analysis.summary,
          reasons: analysis.reasons,
          riskLevel: analysis.riskLevel,
        };

        timeline.push(
          this.tl(
            'investigation_summary',
            now.toISOString(),
            'Investigation Summary',
            analysis.summary,
          ),
        );
        if (analysis.reasons.length) {
          timeline.push(
            this.tl(
              'judgment_reasons',
              now.toISOString(),
              '판단 근거',
              analysis.reasons.join('\n'),
            ),
          );
        }

        try {
          const rec = await this.aiService.generateRecommendation({
            orderNo,
            rental: rentalCtx,
            listing: listingCtx,
            matching: matchingCtx,
            investigationSummary: analysis.summary,
            judgmentReasons: analysis.reasons,
          });
          aiRecommendation = {
            stars: rec.stars,
            headline: rec.headline,
            actions: rec.actions,
            reasons: rec.reasons,
          };
          timeline.push(
            this.tl(
              'ai_recommendation',
              now.toISOString(),
              'AI Recommendation',
              JSON.stringify(aiRecommendation),
            ),
          );
        } catch (recError) {
          this.logger.warn(
            `AI Recommendation skipped: ${
              recError instanceof Error ? recError.message : String(recError)
            }`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Investigation Analysis skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const entity = this.caseRepo.create({
      caseNo,
      productName: listingTitle,
      orderProductName: null,
      listingTitle,
      aiScore,
      status: 'Open',
      priority: this.priorityFromScore(aiScore),
      assignee: null,
      siteCode: result.siteCode,
      url: result.url,
      imageUrl: result.imageUrl ?? null,
      price: result.price != null ? String(result.price) : null,
      resultId: result.id,
      searchHistoryId: history.id,
      searchJobId: job?.id ?? null,
      orderNo,
      contractNo: null,
      customerName: null,
      autoCreated,
      timeline,
      aiAnalysis: this.buildAiAnalysis(result, aiScore),
    });

    const saved = await this.caseRepo.save(entity);
    if (aiOpinion) {
      this.logger.log(
        `Investigation Analysis case=${saved.caseNo} risk=${aiOpinion.riskLevel}`,
      );
    }
    if (aiRecommendation) {
      this.logger.log(
        `AI Recommendation case=${saved.caseNo} stars=${aiRecommendation.stars}`,
      );
    }
    return saved;
  }

  private computeAiScore(result: {
    titleSimilarity?: number | null;
    imageSimilarity?: number | null;
    /** AI Matching Engine 최종 점수 0~100 */
    aiScore?: number | null;
    matchingScore?: number | null;
  }): number {
    if (result.aiScore != null && Number.isFinite(result.aiScore)) {
      return clamp01(result.aiScore / 100);
    }
    if (result.matchingScore != null && Number.isFinite(result.matchingScore)) {
      return clamp01(result.matchingScore / 100);
    }
    const title =
      result.titleSimilarity != null && Number.isFinite(result.titleSimilarity)
        ? result.titleSimilarity
        : 0;
    const image =
      result.imageSimilarity != null && Number.isFinite(result.imageSimilarity)
        ? result.imageSimilarity
        : 0;
    return Math.max(0, Math.min(1, Math.max(title, image)));
  }

  private priorityFromScore(score: number): InvestigationPriority {
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    return 'Low';
  }

  private buildAiAnalysis(
    result: {
      titleSimilarity?: number | null;
      imageSimilarity?: number | null;
      matchingScores?: {
        brand?: number;
        model?: number;
        productName?: number;
        price?: number;
        option?: number;
        color?: number;
        image?: number;
        description?: number;
        ocr?: number;
      } | null;
    },
    aiScore: number,
  ): InvestigationAiAnalysis {
    const ms = result.matchingScores;
    if (ms) {
      return {
        titleSimilarity: clamp01((ms.productName ?? 0) / 100),
        imageSimilarity: clamp01((ms.image ?? 0) / 100),
        brandMatch: clamp01((ms.brand ?? 0) / 100),
        modelMatch: clamp01((ms.model ?? 0) / 100),
        priceSimilarity: clamp01((ms.price ?? 0) / 100),
        ocrMatch: clamp01((ms.ocr ?? 0) / 100),
      };
    }
    const title = clamp01(result.titleSimilarity ?? aiScore * 0.96);
    const image = clamp01(result.imageSimilarity ?? aiScore * 0.7);
    return {
      titleSimilarity: title,
      imageSimilarity: image,
      brandMatch: clamp01(aiScore * 0.9),
      modelMatch: clamp01(aiScore * 0.88),
      priceSimilarity: clamp01(aiScore * 0.75),
      ocrMatch: clamp01(aiScore * 0.65),
    };
  }

  private async nextCaseNumber(now: Date): Promise<string> {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const prefix = `CASE-${y}${m}${d}-`;

    const latest = await this.caseRepo
      .createQueryBuilder('c')
      .where('c.caseNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.caseNo', 'DESC')
      .getOne();

    let seq = 1;
    if (latest?.caseNo) {
      const part = latest.caseNo.slice(prefix.length);
      const n = parseInt(part, 10);
      if (Number.isFinite(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(6, '0')}`;
  }

  private tl(
    kind: string,
    at: string,
    title: string,
    detail?: string | null,
  ): InvestigationTimelineEvent {
    return {
      id: randomUUID(),
      kind,
      at,
      title,
      detail: detail ?? null,
    };
  }

  private toDto(c: InvestigationCaseEntity) {
    const orderNo = c.orderNo;
    const aiOpinion = extractAiOpinion(c.timeline ?? []);
    return {
      id: c.id,
      caseNo: c.caseNo,
      productName: c.listingTitle || c.productName,
      /** 주문 마스터는 복제하지 않음 — orderNo + orderUrl 만 */
      order: {
        orderNo: c.orderNo,
      },
      orderNo: c.orderNo,
      orderUrl: this.buildOrderUrl(orderNo),
      listingTitle: c.listingTitle || c.productName,
      aiScore: c.aiScore,
      aiScorePercent: Math.round(c.aiScore * 100),
      status: c.status,
      priority: c.priority,
      assignee: c.assignee,
      siteCode: c.siteCode,
      url: c.url,
      imageUrl: c.imageUrl,
      price: c.price,
      resultId: c.resultId,
      searchHistoryId: c.searchHistoryId,
      searchJobId: c.searchJobId,
      autoCreated: c.autoCreated,
      timeline: c.timeline ?? [],
      aiAnalysis: c.aiAnalysis,
      /** Investigation Analysis (Plain text) — Recommendation 과 분리 */
      investigationSummary: aiOpinion.summary,
      judgmentReasons: aiOpinion.reasons,
      /** AI Recommendation 패널 */
      aiRecommendation: extractAiRecommendation(c.timeline ?? []),
      createdAt: c.createdAt,
    };
  }

  private buildOrderUrl(orderNo: string | null | undefined): string | null {
    if (!orderNo?.trim()) return null;
    const template =
      this.config.get<string>('investigation.orderUrlTemplate') ||
      '/getOrderInfo?order_id={orderNo}';
    return template.replace(/\{orderNo\}/g, encodeURIComponent(orderNo.trim()));
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function extractAiOpinion(timeline: InvestigationTimelineEvent[]): {
  summary: string | null;
  reasons: string[];
} {
  let summary: string | null = null;
  let reasons: string[] = [];
  for (const ev of timeline) {
    if (ev.kind === 'investigation_summary' && ev.detail) {
      summary = ev.detail;
    }
    if (ev.kind === 'judgment_reasons' && ev.detail) {
      reasons = ev.detail
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { summary, reasons };
}

function extractAiRecommendation(
  timeline: InvestigationTimelineEvent[],
): {
  stars: number;
  headline: string;
  actions: string[];
  reasons: string[];
} | null {
  for (const ev of timeline) {
    if (ev.kind !== 'ai_recommendation' || !ev.detail) continue;
    try {
      const parsed = JSON.parse(ev.detail) as {
        stars?: number;
        headline?: string;
        actions?: string[];
        reasons?: string[];
      };
      const stars =
        typeof parsed.stars === 'number' && Number.isFinite(parsed.stars)
          ? Math.max(1, Math.min(5, Math.round(parsed.stars)))
          : 3;
      return {
        stars,
        headline: String(parsed.headline || '').trim() || '추가 확인이 필요합니다.',
        actions: Array.isArray(parsed.actions)
          ? parsed.actions.filter((x): x is string => typeof x === 'string')
          : [],
        reasons: Array.isArray(parsed.reasons)
          ? parsed.reasons.filter((x): x is string => typeof x === 'string')
          : [],
      };
    } catch {
      return null;
    }
  }
  return null;
}

function parseLoosePrice(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9.]/g, '');
    if (!digits) return null;
    const n = parseFloat(digits);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function minutesBefore(date: Date, minutes: number): string {
  return new Date(date.getTime() - minutes * 60_000).toISOString();
}
