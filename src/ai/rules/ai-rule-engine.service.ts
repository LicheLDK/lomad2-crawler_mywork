import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiRule,
  type AiRuleAction,
} from '@/database/entities/ai-rule.entity';
import { buildDefaultAiRules } from './default-rules';
import type {
  AiRuleContext,
  AiRuleDefinition,
  AiRuleEvaluation,
  AiRuleMatch,
} from './ai-rule.types';

/**
 * AI Rule Engine — 별도 Service
 * Rule 은 DB 또는 Config(AI_RULES_JSON / 기본 seed)에서 로드. 하드코딩 분기 금지.
 */
@Injectable()
export class AiRuleEngineService implements OnModuleInit {
  private readonly logger = new Logger(AiRuleEngineService.name);
  /** DB 실패 시 Config fallback 캐시 */
  private configRulesCache: AiRuleDefinition[] | null = null;

  constructor(
    @InjectRepository(AiRule)
    private readonly ruleRepo: Repository<AiRule>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  /** DB에 규칙이 없으면 Config/기본값을 seed */
  async ensureSeeded(): Promise<void> {
    try {
      const count = await this.ruleRepo.count();
      if (count > 0) return;

      const defs = this.loadConfigDefinitions();
      for (const def of defs) {
        await this.ruleRepo.save(
          this.ruleRepo.create({
            code: def.code,
            name: def.name,
            description: def.description ?? null,
            enabled: def.enabled !== false,
            priority: def.priority ?? 100,
            field: def.field,
            operator: def.operator,
            value: def.value,
            action: def.action,
            message: def.message ?? null,
            source: 'seed',
          }),
        );
      }
      this.logger.log(`AI Rules seeded count=${defs.length}`);
    } catch (error) {
      this.logger.warn(
        `AI Rules seed skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** 활성 규칙 로드 (DB 우선, 실패 시 Config) */
  async getActiveRules(): Promise<AiRuleDefinition[]> {
    try {
      const rows = await this.ruleRepo.find({
        where: { enabled: true },
        order: { priority: 'DESC', code: 'ASC' },
      });
      if (rows.length > 0) {
        return rows.map((r) => ({
          code: r.code,
          name: r.name,
          description: r.description,
          enabled: r.enabled,
          priority: r.priority,
          field: r.field,
          operator: r.operator,
          value: Number(r.value),
          action: r.action,
          message: r.message,
        }));
      }
    } catch (error) {
      this.logger.warn(
        `AI Rules DB load failed, using config: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return this.loadConfigDefinitions().filter((r) => r.enabled !== false);
  }

  async listAll(): Promise<AiRule[]> {
    return this.ruleRepo.find({ order: { priority: 'DESC', code: 'ASC' } });
  }

  /**
   * 규칙 평가
   * - exclude 매칭 시 create 억제
   * - warning 은 누적
   * - create_investigation 매칭 + exclude 아님 → 생성
   */
  async evaluate(input: AiRuleContext): Promise<AiRuleEvaluation> {
    const context = normalizeContext(input);
    const rules = await this.getActiveRules();
    const sorted = [...rules].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );

    const matched: AiRuleMatch[] = [];
    const warnings: AiRuleMatch[] = [];
    let exclude = false;
    let createInvestigation = false;
    let createThreshold: number | null = null;

    for (const rule of sorted) {
      if (rule.action === 'create_investigation' && createThreshold == null) {
        createThreshold = Number(rule.value);
      }

      const actual = readField(context, rule.field);
      if (actual == null) continue;
      if (!compare(actual, rule.operator, Number(rule.value))) continue;

      const hit: AiRuleMatch = {
        code: rule.code,
        name: rule.name,
        action: rule.action,
        field: String(rule.field),
        operator: String(rule.operator),
        value: Number(rule.value),
        actual,
        message: rule.message ?? buildDefaultMessage(rule),
        priority: rule.priority ?? 0,
      };
      matched.push(hit);

      const action = String(rule.action) as AiRuleAction;
      if (action === 'exclude') {
        exclude = true;
      } else if (action === 'create_investigation') {
        createInvestigation = true;
      } else if (action === 'warning') {
        warnings.push(hit);
      }
    }

    if (exclude) {
      createInvestigation = false;
    }

    return {
      createInvestigation,
      exclude,
      warnings,
      matched,
      createThreshold,
      context,
    };
  }

  /** create_investigation 규칙의 임계값 (Dashboard/호환) */
  async getCreateThreshold(): Promise<number> {
    const rules = await this.getActiveRules();
    const create = rules.find((r) => r.action === 'create_investigation');
    if (create && Number.isFinite(create.value)) {
      return Math.max(0, Math.min(100, Math.round(create.value)));
    }
    const fallback = this.config.get<number>('investigation.aiScoreThreshold');
    return Number.isFinite(fallback) ? Number(fallback) : 90;
  }

  private loadConfigDefinitions(): AiRuleDefinition[] {
    if (this.configRulesCache) return this.configRulesCache;

    const fromEnv = this.config.get<AiRuleDefinition[]>('ai.rules');
    if (Array.isArray(fromEnv) && fromEnv.length > 0) {
      this.configRulesCache = fromEnv;
      return fromEnv;
    }

    const threshold =
      this.config.get<number>('investigation.aiScoreThreshold') ?? 90;
    this.configRulesCache = buildDefaultAiRules(Number(threshold) || 90);
    return this.configRulesCache;
  }
}

function normalizeContext(
  input: AiRuleContext,
): AiRuleContext & { priceDiffPercent: number | null } {
  const aiScore = clampScore100(input.aiScore);
  const matchingScore =
    input.matchingScore != null ? clampScore100(input.matchingScore) : null;
  const titleSimilarity =
    input.titleSimilarity != null
      ? normalizeSimilarity(input.titleSimilarity)
      : null;
  const imageSimilarity =
    input.imageSimilarity != null
      ? normalizeSimilarity(input.imageSimilarity)
      : null;

  let priceDiffPercent =
    input.priceDiffPercent != null && Number.isFinite(input.priceDiffPercent)
      ? Math.abs(Number(input.priceDiffPercent))
      : null;

  if (priceDiffPercent == null) {
    priceDiffPercent = calcPriceDiffPercent(
      input.rentalPrice,
      input.listingPrice,
    );
  }

  return {
    aiScore,
    matchingScore,
    titleSimilarity,
    imageSimilarity,
    rentalPrice: input.rentalPrice ?? null,
    listingPrice: input.listingPrice ?? null,
    priceDiffPercent,
  };
}

function readField(
  ctx: AiRuleContext & { priceDiffPercent: number | null },
  field: string,
): number | null {
  switch (field) {
    case 'aiScore':
      return ctx.aiScore;
    case 'matchingScore':
      return ctx.matchingScore ?? null;
    case 'priceDiffPercent':
      return ctx.priceDiffPercent;
    case 'titleSimilarity':
      return ctx.titleSimilarity ?? null;
    case 'imageSimilarity':
      return ctx.imageSimilarity ?? null;
    default:
      return null;
  }
}

function compare(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case 'gte':
      return actual >= expected;
    case 'lte':
      return actual <= expected;
    case 'gt':
      return actual > expected;
    case 'lt':
      return actual < expected;
    case 'eq':
      return Math.abs(actual - expected) < 1e-9;
    default:
      return false;
  }
}

function calcPriceDiffPercent(
  rentalPrice?: number | null,
  listingPrice?: number | null,
): number | null {
  const rental = toNumber(rentalPrice);
  const listing = toNumber(listingPrice);
  if (rental == null || listing == null || rental <= 0) return null;
  return Math.abs(((listing - rental) / rental) * 100);
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 0~1 또는 0~100 → 0~100 */
function normalizeSimilarity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0 && value <= 1) return Math.round(value * 100);
  return clampScore100(value);
}

function clampScore100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildDefaultMessage(rule: AiRuleDefinition): string {
  return `${rule.field} ${rule.operator} ${rule.value} → ${rule.action}`;
}
