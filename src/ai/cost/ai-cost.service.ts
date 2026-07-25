import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AiUsageLog } from '@/database/entities/ai-usage-log.entity';
import {
  estimateCostUsd,
  parsePriceOverrides,
  roundCost,
  type AiModelPrice,
} from './ai-cost.pricing';
import type {
  AiCostDashboardSummary,
  AiUsageBucket,
  AiUsageByProvider,
  AiUsageRecordInput,
} from './ai-cost.types';

const PROMPT_PREVIEW_MAX = 4000;
const RESPONSE_PREVIEW_MAX = 2000;

/**
 * AI Cost Management
 * - 호출 기록: Provider / Model / Token / Prompt / Response Time / Cost / Retry
 * - Dashboard 집계: 오늘 사용량 · 월간 비용 · Provider별 사용량
 */
@Injectable()
export class AiCostService {
  private readonly logger = new Logger(AiCostService.name);
  private readonly priceOverrides: Record<string, AiModelPrice> | null;

  constructor(
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
    private readonly config: ConfigService,
  ) {
    this.priceOverrides = parsePriceOverrides(
      this.config.get<string>('ai.costPricesJson'),
    );
  }

  /** 호출 1건 기록 (실패해도 호출 흐름을 막지 않음) */
  async record(input: AiUsageRecordInput): Promise<AiUsageLog | null> {
    try {
      const promptTokens = Math.max(0, Math.floor(input.promptTokens ?? 0));
      const completionTokens = Math.max(
        0,
        Math.floor(input.completionTokens ?? 0),
      );
      const totalTokens =
        input.totalTokens != null
          ? Math.max(0, Math.floor(input.totalTokens))
          : promptTokens + completionTokens;

      const costUsd =
        input.costUsd != null
          ? roundCost(input.costUsd)
          : estimateCostUsd({
              model: input.model,
              promptTokens,
              completionTokens,
              overrides: this.priceOverrides,
            });

      const row = this.usageRepo.create({
        provider: String(input.provider),
        model: input.model || 'unknown',
        task: String(input.task),
        promptTokens,
        completionTokens,
        totalTokens,
        promptPreview: truncate(input.prompt, PROMPT_PREVIEW_MAX),
        responsePreview: truncate(input.response, RESPONSE_PREVIEW_MAX),
        responseTimeMs: Math.max(0, Math.floor(input.responseTimeMs)),
        costUsd: costUsd.toFixed(6),
        retryCount: Math.max(0, Math.floor(input.retryCount ?? 0)),
        success: input.success,
        errorMessage: input.errorMessage?.slice(0, 2000) ?? null,
        metadata: input.metadata ?? null,
      });

      const saved = await this.usageRepo.save(row);
      this.logger.debug(
        `AI usage recorded provider=${saved.provider} model=${saved.model} tokens=${saved.totalTokens} cost=${saved.costUsd} retry=${saved.retryCount}`,
      );
      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI usage record failed: ${message}`);
      return null;
    }
  }

  /** Dashboard 요약 (오늘 + 이번 달 + Provider별) */
  async getDashboardSummary(
    now: Date = new Date(),
  ): Promise<AiCostDashboardSummary> {
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [todayLogs, monthLogs] = await Promise.all([
      this.usageRepo.find({
        where: { createdAt: Between(todayStart, todayEnd) },
        select: [
          'provider',
          'promptTokens',
          'completionTokens',
          'totalTokens',
          'costUsd',
          'responseTimeMs',
          'retryCount',
          'success',
        ],
      }),
      this.usageRepo.find({
        where: { createdAt: Between(monthStart, monthEnd) },
        select: [
          'provider',
          'promptTokens',
          'completionTokens',
          'totalTokens',
          'costUsd',
          'responseTimeMs',
          'retryCount',
          'success',
        ],
      }),
    ]);

    return {
      today: {
        date: formatDate(now),
        ...aggregateBucket(todayLogs),
      },
      month: {
        yearMonth: formatYearMonth(now),
        ...aggregateBucket(monthLogs),
      },
      byProvider: aggregateByProvider(monthLogs),
      currency: 'USD',
      generatedAt: now.toISOString(),
    };
  }

  /** 오늘 사용량만 */
  async getTodayUsage(now: Date = new Date()): Promise<AiUsageBucket & { date: string }> {
    const summary = await this.getDashboardSummary(now);
    return summary.today;
  }

  /** 월간 비용 */
  async getMonthlyCost(
    yearMonth?: string,
    now: Date = new Date(),
  ): Promise<AiUsageBucket & { yearMonth: string }> {
    if (!yearMonth) {
      const summary = await this.getDashboardSummary(now);
      return summary.month;
    }
    const [y, m] = yearMonth.split('-').map((x) => parseInt(x, 10));
    if (!y || !m) {
      const summary = await this.getDashboardSummary(now);
      return summary.month;
    }
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = endOfMonth(start);
    const logs = await this.usageRepo.find({
      where: { createdAt: Between(start, end) },
      select: [
        'provider',
        'promptTokens',
        'completionTokens',
        'totalTokens',
        'costUsd',
        'responseTimeMs',
        'retryCount',
        'success',
      ],
    });
    return {
      yearMonth,
      ...aggregateBucket(logs),
    };
  }

  /** Provider별 사용량 (기본: 이번 달) */
  async getUsageByProvider(
    from?: Date,
    to?: Date,
    now: Date = new Date(),
  ): Promise<AiUsageByProvider[]> {
    const start = from ?? startOfMonth(now);
    const end = to ?? endOfMonth(now);
    const logs = await this.usageRepo.find({
      where: { createdAt: Between(start, end) },
      select: [
        'provider',
        'promptTokens',
        'completionTokens',
        'totalTokens',
        'costUsd',
        'responseTimeMs',
        'retryCount',
        'success',
      ],
    });
    return aggregateByProvider(logs);
  }
}

type LogSlice = Pick<
  AiUsageLog,
  | 'provider'
  | 'promptTokens'
  | 'completionTokens'
  | 'totalTokens'
  | 'costUsd'
  | 'responseTimeMs'
  | 'retryCount'
  | 'success'
>;

function aggregateBucket(logs: LogSlice[]): AiUsageBucket {
  if (logs.length === 0) {
    return {
      callCount: 0,
      successCount: 0,
      failureCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      avgResponseTimeMs: 0,
      retryTotal: 0,
    };
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let costUsd = 0;
  let responseTimeSum = 0;
  let retryTotal = 0;
  let successCount = 0;

  for (const log of logs) {
    promptTokens += log.promptTokens || 0;
    completionTokens += log.completionTokens || 0;
    totalTokens += log.totalTokens || 0;
    costUsd += Number(log.costUsd) || 0;
    responseTimeSum += log.responseTimeMs || 0;
    retryTotal += log.retryCount || 0;
    if (log.success) successCount += 1;
  }

  return {
    callCount: logs.length,
    successCount,
    failureCount: logs.length - successCount,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd: roundCost(costUsd),
    avgResponseTimeMs: Math.round(responseTimeSum / logs.length),
    retryTotal,
  };
}

function aggregateByProvider(logs: LogSlice[]): AiUsageByProvider[] {
  const map = new Map<string, LogSlice[]>();
  for (const log of logs) {
    const key = log.provider || 'unknown';
    const list = map.get(key) ?? [];
    list.push(log);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([provider, rows]) => ({
      provider,
      ...aggregateBucket(rows),
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
}

function truncate(value?: string | null, max = 4000): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    23,
    59,
    59,
    999,
  );
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatYearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
