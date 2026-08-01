import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CrawlerResult } from '@/database/entities/crawler-result.entity';
import { SearchHistory } from '@/database/entities/search-history.entity';
import { SearchHistoryResult } from '@/database/entities/search-history-result.entity';
import { SearchJob } from '@/database/entities/search-job.entity';
import {
  InvestigationAiAnalysis,
  InvestigationCaseEntity,
  InvestigationNote,
  InvestigationPriority,
  InvestigationStatus,
  InvestigationTimelineEvent,
} from '@/database/entities/investigation-case.entity';
import { AiService } from '@/ai/ai.service';
import { AiRuleEngineService } from '@/ai/rules/ai-rule-engine.service';
import type { AiRuleMatch } from '@/ai/rules/ai-rule.types';
import { canTransitionStatus } from './investigation.workflow';
import type { CreateFinalDecisionDto } from './dto/create-final-decision.dto';
import type { CreateInvestigationDto } from './dto/create-investigation.dto';
import type { CreateInvestigationNoteDto } from './dto/create-investigation-note.dto';
import type { UpdateInvestigationDto } from './dto/update-investigation.dto';
import type { UpdateInvestigationNoteDto } from './dto/update-investigation-note.dto';
import type { UpdateInvestigationStatusDto } from './dto/update-investigation-status.dto';

export type AutoCreateResult = {
  created: InvestigationCaseEntity[];
  updated: InvestigationCaseEntity[];
  skipped: number;
  excluded: number;
  warned: number;
  /** 워치리스트로 생성/갱신된 건수 (created+updated 중 watchlisted) */
  watchlisted: number;
  threshold: number;
  watchlistMinScore: number;
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
    @InjectRepository(CrawlerResult)
    private readonly resultRepo: Repository<CrawlerResult>,
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

  /**
   * 워치리스트 하한 (0~100). 0 이하면 워치리스트 비활성.
   * createThreshold 미만 · watchlistMin 이상 → Investigation + watchlisted
   */
  getWatchlistMinScore(): number {
    const raw = this.config.get<number>('investigation.watchlistMinScore');
    const n = Number.isFinite(raw) ? Number(raw) : 70;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  isAutoCreateEnabled(): boolean {
    return this.config.get<boolean>('investigation.autoCreateEnabled') !== false;
  }

  private emptyAutoCreateResult(
    threshold: number,
    watchlistMinScore: number,
  ): AutoCreateResult {
    return {
      created: [],
      updated: [],
      skipped: 0,
      excluded: 0,
      warned: 0,
      watchlisted: 0,
      threshold,
      watchlistMinScore,
    };
  }

  /**
   * 검색 완료 후 AI Score 기준 Investigation 자동 생성.
   * - score ≥ createThreshold → Open (watchlisted=false)
   * - watchlistMin ≤ score < createThreshold → Open + watchlisted=true
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
    const threshold = await this.getAiScoreThreshold();
    const watchlistMinScore = this.getWatchlistMinScore();

    if (!this.isAutoCreateEnabled()) {
      return this.emptyAutoCreateResult(threshold, watchlistMinScore);
    }

    const history = await this.historyRepo.findOne({
      where: { id: params.searchHistoryId },
    });
    if (!history) {
      return this.emptyAutoCreateResult(threshold, watchlistMinScore);
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
            matchingScore: link.matchingScore,
            aiScore: link.aiScore,
            matchingReason: link.matchingReason,
            matchingScores: link.matchingScores,
          }));

    const created: InvestigationCaseEntity[] = [];
    const updated: InvestigationCaseEntity[] = [];
    let skipped = 0;
    let excluded = 0;
    let warned = 0;
    let watchlisted = 0;
    const rentalPrice = parseLoosePrice(params.rentalPrice);

    for (const result of sourceResults) {
      const aiScore01 = this.computeAiScore(result);
      const aiScore100 = Math.round(aiScore01 * 100);

      let ruleWarnings: AiRuleMatch[] = [];
      let shouldCreate = false;
      let asWatchlist = false;

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
          if (this.isAiResult(result)) {
            const existing = await this.caseRepo.findOne({
              where: { resultId: result.id },
            });
            if (existing) {
              await this.recordAiExcludeRecommendation({
                existing,
                result,
                matchedRules: evaluation.matched,
                job,
              });
            }
          }

          excluded += 1;
          skipped += 1;
          this.logger.debug(
            `Rule exclude result=${result.id} score=${aiScore100} matched=${evaluation.matched
              .map((m) => m.code)
              .join(',')}`,
          );
          continue;
        }

        if (evaluation.createInvestigation) {
          shouldCreate = true;
          asWatchlist = false;
        } else if (
          watchlistMinScore > 0 &&
          aiScore100 >= watchlistMinScore &&
          aiScore100 < threshold
        ) {
          shouldCreate = true;
          asWatchlist = true;
        }

        ruleWarnings = evaluation.warnings;
        if (ruleWarnings.length) warned += 1;
      } else if (aiScore100 >= threshold) {
        shouldCreate = true;
        asWatchlist = false;
      } else if (
        watchlistMinScore > 0 &&
        aiScore100 >= watchlistMinScore
      ) {
        shouldCreate = true;
        asWatchlist = true;
      }

      if (!shouldCreate) {
        skipped += 1;
        continue;
      }

      const existing = await this.caseRepo.findOne({
        where: { resultId: result.id },
      });
      if (existing) {
        if (!this.isAiResult(result) || existing.status !== 'Open') {
          skipped += 1;
          continue;
        }

        const updatedCase = await this.updateCaseFromAiResult({
          existing,
          result,
          aiScore: aiScore01,
          history,
          job,
          threshold,
          ruleWarnings,
          watchlisted: asWatchlist,
        });
        updated.push(updatedCase);
        if (updatedCase.watchlisted) watchlisted += 1;
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
        watchlisted: asWatchlist,
      });
      created.push(caseEntity);
      if (caseEntity.watchlisted) watchlisted += 1;
    }

    if (created.length) {
      this.logger.log(
        `Auto-created ${created.length} investigation(s) for search=${params.searchHistoryId} threshold=${threshold} watchlistMin=${watchlistMinScore} watchlisted=${watchlisted} excluded=${excluded} warned=${warned}`,
      );
    }

    if (updated.length) {
      this.logger.log(
        `Updated ${updated.length} investigation(s) with AI score for search=${params.searchHistoryId}`,
      );
    }

    return {
      created,
      updated,
      skipped,
      excluded,
      warned,
      watchlisted,
      threshold,
      watchlistMinScore,
    };
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

  /**
   * Overview용 집계.
   * last24h: 최근 24시간 생성 케이스 수
   * byStatus: 상태별 전체 건수
   */
  async getStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24h = await this.caseRepo
      .createQueryBuilder('c')
      .where('c.createdAt >= :since', { since })
      .getCount();

    const rows = await this.caseRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('c.status')
      .getRawMany<{ status: string; cnt: string }>();

    const byStatus: Record<InvestigationStatus, number> = {
      Open: 0,
      Investigating: 0,
      Review: 0,
      Completed: 0,
      Archived: 0,
    };
    for (const row of rows) {
      if (row.status in byStatus) {
        byStatus[row.status as InvestigationStatus] = Number(row.cnt) || 0;
      }
    }

    return { last24h, byStatus };
  }

  async updateStatus(id: string, dto: UpdateInvestigationStatusDto) {
    const row = await this.requireCase(id);
    const next = dto.status;

    if (!canTransitionStatus(row.status, next)) {
      throw new BadRequestException(
        `Illegal status transition: ${row.status} → ${next}`,
      );
    }

    if (row.status === next) {
      return this.toDto(row);
    }

    const now = new Date();
    const timeline = [...(row.timeline ?? [])];
    timeline.push(
      this.tl(
        'status_changed',
        now.toISOString(),
        '상태 변경',
        `${row.status} → ${next}`,
      ),
    );

    row.status = next;
    row.timeline = timeline;
    const saved = await this.caseRepo.save(row);
    return this.toDto(saved);
  }

  async updateAssignment(id: string, dto: UpdateInvestigationDto) {
    const row = await this.requireCase(id);
    const now = new Date();
    const timeline = [...(row.timeline ?? [])];
    let changed = false;

    if (dto.assignee !== undefined && dto.assignee !== row.assignee) {
      const prev = row.assignee;
      row.assignee = dto.assignee;
      timeline.push(
        this.tl(
          'assignee_set',
          now.toISOString(),
          '담당자 변경',
          dto.assignee
            ? prev
              ? `${prev} → ${dto.assignee}`
              : dto.assignee
            : prev
              ? `${prev} → (해제)`
              : '(해제)',
        ),
      );
      changed = true;
    }

    if (dto.priority !== undefined && dto.priority !== row.priority) {
      row.priority = dto.priority;
      changed = true;
    }

    if (dto.dueDate !== undefined) {
      const nextDue = dto.dueDate ? new Date(dto.dueDate) : null;
      const prevMs = row.dueDate?.getTime() ?? null;
      const nextMs = nextDue?.getTime() ?? null;
      if (prevMs !== nextMs) {
        row.dueDate = nextDue;
        changed = true;
      }
    }

    if (!changed) {
      return this.toDto(row);
    }

    row.timeline = timeline;
    const saved = await this.caseRepo.save(row);
    return this.toDto(saved);
  }

  async addNote(id: string, dto: CreateInvestigationNoteDto) {
    const row = await this.requireCase(id);
    const now = new Date();
    const note: InvestigationNote = {
      id: randomUUID(),
      body: dto.body.trim(),
      author: (dto.author?.trim() || '담당자').slice(0, 100),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const notes = [...(row.notes ?? []), note];
    const timeline = [...(row.timeline ?? [])];
    timeline.push(
      this.tl(
        'note_added',
        now.toISOString(),
        '메모 추가',
        note.body.length > 120 ? `${note.body.slice(0, 117)}...` : note.body,
      ),
    );

    row.notes = notes;
    row.timeline = timeline;
    const saved = await this.caseRepo.save(row);
    return this.toDto(saved);
  }

  async updateNote(
    id: string,
    noteId: string,
    dto: UpdateInvestigationNoteDto,
  ) {
    const row = await this.requireCase(id);
    const notes = [...(row.notes ?? [])];
    const idx = notes.findIndex((n) => n.id === noteId);
    if (idx < 0) {
      throw new NotFoundException(`Note not found: ${noteId}`);
    }

    const now = new Date();
    notes[idx] = {
      ...notes[idx],
      body: dto.body.trim(),
      updatedAt: now.toISOString(),
    };
    row.notes = notes;
    const saved = await this.caseRepo.save(row);
    return this.toDto(saved);
  }

  async deleteNote(id: string, noteId: string) {
    const row = await this.requireCase(id);
    const notes = row.notes ?? [];
    if (!notes.some((n) => n.id === noteId)) {
      throw new NotFoundException(`Note not found: ${noteId}`);
    }
    row.notes = notes.filter((n) => n.id !== noteId);
    const saved = await this.caseRepo.save(row);
    return this.toDto(saved);
  }

  async applyFinalDecision(id: string, dto: CreateFinalDecisionDto) {
    const row = await this.requireCase(id);

    if (row.status === 'Archived') {
      throw new BadRequestException(
        'Cannot apply final decision to an Archived case',
      );
    }

    const now = new Date();
    const alreadyCompleted = row.status === 'Completed';
    const nextNote = dto.note?.trim() || null;
    const sameDecision =
      alreadyCompleted &&
      row.finalDecision === dto.decision &&
      (row.finalDecisionNote ?? null) === nextNote;

    if (sameDecision) {
      return this.toDto(row);
    }

    const timeline = [...(row.timeline ?? [])];
    timeline.push(
      this.tl(
        'final_decision',
        now.toISOString(),
        '최종 판단',
        nextNote ? `${dto.decision}: ${nextNote}` : dto.decision,
      ),
    );

    if (!alreadyCompleted) {
      timeline.push(
        this.tl(
          'status_changed',
          now.toISOString(),
          '상태 변경',
          `${row.status} → Completed`,
        ),
      );
      timeline.push(
        this.tl('completed', now.toISOString(), '조사 완료', row.caseNo),
      );
      row.status = 'Completed';
    }

    row.finalDecision = dto.decision;
    row.finalDecisionNote = nextNote;
    row.decidedAt = now;
    row.timeline = timeline;
    const saved = await this.caseRepo.save(row);
    return this.toDto(saved);
  }

  /**
   * 수동 조사 시작.
   * resultId 중복 시 새 row 없이 기존 케이스 반환 (HTTP 200).
   */
  async createManual(dto: CreateInvestigationDto) {
    const existing = await this.caseRepo.findOne({
      where: { resultId: dto.resultId },
    });
    if (existing) {
      return this.toDto(existing);
    }

    const result = await this.resultRepo.findOne({
      where: { id: dto.resultId },
    });
    if (!result) {
      throw new NotFoundException(`Crawler result not found: ${dto.resultId}`);
    }

    let historyId = dto.searchHistoryId ?? result.searchHistoryId ?? null;
    if (!historyId) {
      const link = await this.historyResultRepo.findOne({
        where: { resultId: dto.resultId },
        order: { createdAt: 'DESC' },
      });
      historyId = link?.searchHistoryId ?? null;
    }
    if (!historyId) {
      throw new BadRequestException(
        'searchHistoryId is required when the listing has no search history link',
      );
    }

    const history = await this.historyRepo.findOne({
      where: { id: historyId },
    });
    if (!history) {
      throw new NotFoundException(`Search history not found: ${historyId}`);
    }

    let job: SearchJob | null = null;
    if (dto.searchJobId) {
      job = await this.jobRepo.findOne({ where: { id: dto.searchJobId } });
      if (!job) {
        throw new NotFoundException(`Search job not found: ${dto.searchJobId}`);
      }
    } else {
      job = await this.jobRepo.findOne({
        where: { searchHistoryId: historyId },
      });
    }

    const link = await this.historyResultRepo.findOne({
      where: { resultId: dto.resultId, searchHistoryId: historyId },
    });

    const listing = {
      id: result.id,
      title: link?.title ?? result.title,
      siteCode: result.siteCode,
      url: result.url,
      imageUrl: link?.imageUrl ?? result.imageUrl,
      price: link?.price ?? result.price,
      description: result.description,
      titleSimilarity: link?.titleSimilarity ?? result.titleSimilarity,
      imageSimilarity: link?.imageSimilarity ?? result.imageSimilarity,
    };
    const aiScore = this.computeAiScore(listing);
    const threshold = await this.getAiScoreThreshold();

    const caseEntity = await this.createCaseFromResult({
      result: listing,
      aiScore,
      history,
      job,
      autoCreated: false,
      threshold,
      orderNoOverride: dto.orderNo?.trim() || null,
    });

    return this.toDto(caseEntity);
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
    /** 수동 생성 시 job.orderNo 가 없을 때 사용 */
    orderNoOverride?: string | null;
    /** 워치리스트(관찰) 플래그 */
    watchlisted?: boolean;
  }): Promise<InvestigationCaseEntity> {
    const {
      result,
      aiScore,
      history,
      job,
      autoCreated,
      threshold,
      ruleWarnings = [],
      orderNoOverride = null,
      watchlisted = false,
    } = params;
    const now = new Date();
    const caseNo = await this.nextCaseNumber(now);
    const scorePct = Math.round(aiScore * 100);

    /** Investigation 은 listing + Job 링크만. 주문 마스터는 복제하지 않는다. */
    const orderNo =
      job?.orderNo?.trim() || orderNoOverride?.trim() || null;
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
        watchlisted
          ? 'Investigation 워치리스트 등록'
          : autoCreated
            ? 'Investigation 자동 생성'
            : 'Investigation 생성',
        watchlisted
          ? `${caseNo} (워치리스트 · AI Score ${scorePct}% · ${this.getWatchlistMinScore()}~${threshold - 1})`
          : autoCreated
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
      watchlisted,
      timeline,
      aiAnalysis: this.buildAiAnalysis(result, aiScore),
      notes: [],
      finalDecision: null,
      finalDecisionNote: null,
      decidedAt: null,
      dueDate: null,
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

  private async updateCaseFromAiResult(params: {
    existing: InvestigationCaseEntity;
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
    threshold: number;
    ruleWarnings?: AiRuleMatch[];
    watchlisted?: boolean;
  }): Promise<InvestigationCaseEntity> {
    const {
      existing,
      result,
      aiScore,
      history,
      job,
      threshold,
      ruleWarnings = [],
      watchlisted = false,
    } = params;
    const now = new Date();
    const scorePct = Math.round(aiScore * 100);
    const prevPct = Math.round((existing.aiScore ?? 0) * 100);
    const orderNo = job?.orderNo?.trim() || existing.orderNo || null;
    const timeline = Array.isArray(existing.timeline) ? [...existing.timeline] : [];

    timeline.push(
      this.tl(
        'ai_score_updated',
        now.toISOString(),
        watchlisted ? 'AI 매칭 점수 갱신 (워치리스트)' : 'AI 매칭 점수로 갱신',
        result.matchingReason
          ? `AI Score ${scorePct}% (기존 ${prevPct}%) · ${result.matchingReason}`
          : `AI Score ${scorePct}% (기존 ${prevPct}%) · threshold ${threshold}`,
      ),
    );

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

    if (orderNo && orderNo !== existing.orderNo) {
      timeline.push(
        this.tl(
          'order_mapped',
          now.toISOString(),
          '주문 참조 연결',
          `orderNo=${orderNo}${job?.id ? ` · jobId=${job.id}` : ''}`,
        ),
      );
    }

    const entity = this.caseRepo.create({
      ...existing,
      productName: result.title,
      listingTitle: result.title,
      aiScore,
      priority: this.priorityFromScore(aiScore),
      siteCode: result.siteCode,
      url: result.url,
      imageUrl: result.imageUrl ?? existing.imageUrl,
      price: result.price != null ? String(result.price) : existing.price,
      searchHistoryId: history.id,
      searchJobId: job?.id ?? existing.searchJobId,
      orderNo,
      watchlisted,
      timeline,
      aiAnalysis: this.buildAiAnalysis(result, aiScore),
    });

    return this.caseRepo.save(entity);
  }

  private async recordAiExcludeRecommendation(params: {
    existing: InvestigationCaseEntity;
    result: {
      id: string;
      matchingScore?: number | null;
      aiScore?: number | null;
      matchingReason?: string | null;
    };
    matchedRules: AiRuleMatch[];
    job: SearchJob | null;
  }): Promise<InvestigationCaseEntity> {
    const { existing, result, matchedRules, job } = params;
    const now = new Date();
    const timeline = Array.isArray(existing.timeline) ? [...existing.timeline] : [];
    const scorePct = Math.round(
      this.computeAiScore({
        aiScore: result.aiScore,
        matchingScore: result.matchingScore,
      }) * 100,
    );
    const ruleSummary = matchedRules.length
      ? matchedRules
          .map((rule) => rule.message || rule.code)
          .filter(Boolean)
          .join(' | ')
      : null;
    const orderNo = job?.orderNo?.trim() || existing.orderNo || null;

    timeline.push(
      this.tl(
        'ai_exclude_recommendation',
        now.toISOString(),
        'AI 재평가 결과 제외 권고',
        [result.matchingReason ? `AI Score ${scorePct}% · ${result.matchingReason}` : `AI Score ${scorePct}%`, ruleSummary]
          .filter(Boolean)
          .join(' | '),
      ),
    );

    const entity = this.caseRepo.create({
      ...existing,
      searchJobId: job?.id ?? existing.searchJobId,
      orderNo,
      timeline,
    });

    return this.caseRepo.save(entity);
  }

  private isAiResult(result: {
    matchingScore?: number | null;
    aiScore?: number | null;
    matchingReason?: string | null;
    matchingScores?: Record<string, number> | null;
  }): boolean {
    return Boolean(
      (result.aiScore != null && Number.isFinite(result.aiScore)) ||
        (result.matchingScore != null && Number.isFinite(result.matchingScore)) ||
        result.matchingReason ||
        result.matchingScores,
    );
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

  private async requireCase(id: string): Promise<InvestigationCaseEntity> {
    const row = await this.caseRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Investigation not found: ${id}`);
    }
    return row;
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
      watchlisted: c.watchlisted ?? false,
      timeline: c.timeline ?? [],
      aiAnalysis: c.aiAnalysis,
      /** Investigation Analysis (Plain text) — Recommendation 과 분리 */
      investigationSummary: aiOpinion.summary,
      judgmentReasons: aiOpinion.reasons,
      /** AI Recommendation 패널 */
      aiRecommendation: extractAiRecommendation(c.timeline ?? []),
      notes: c.notes ?? [],
      finalDecision: c.finalDecision ?? null,
      finalDecisionNote: c.finalDecisionNote ?? null,
      decidedAt: c.decidedAt ?? null,
      dueDate: c.dueDate ?? null,
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
