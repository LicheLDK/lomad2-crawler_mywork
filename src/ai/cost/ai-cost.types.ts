import type { AiProviderName, AiTaskKind } from '../ai.types';

/** 호출 1건 기록 입력 */
export interface AiUsageRecordInput {
  provider: AiProviderName | string;
  model: string;
  task: AiTaskKind | string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** Prompt 전문 또는 조립 텍스트 (서비스에서 truncate) */
  prompt?: string | null;
  response?: string | null;
  responseTimeMs: number;
  retryCount?: number;
  success: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  /** 직접 지정 시 estimate 건너뜀 */
  costUsd?: number;
}

export interface AiUsageBucket {
  callCount: number;
  successCount: number;
  failureCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD */
  costUsd: number;
  avgResponseTimeMs: number;
  retryTotal: number;
}

/** Provider별 사용량 */
export interface AiUsageByProvider extends AiUsageBucket {
  provider: string;
}

/** Dashboard 요약 — UI 미구현, API/타입만 설계 */
export interface AiCostDashboardSummary {
  /** 오늘 사용량 */
  today: AiUsageBucket & {
    date: string; // YYYY-MM-DD
  };
  /** 월간 비용 */
  month: AiUsageBucket & {
    yearMonth: string; // YYYY-MM
  };
  /** Provider별 사용량 (조회 기간 = 이번 달) */
  byProvider: AiUsageByProvider[];
  currency: 'USD';
  generatedAt: string;
}
