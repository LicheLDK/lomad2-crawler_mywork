import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * AI 호출 비용·사용량 로그
 * Dashboard: 오늘 사용량 / 월간 비용 / Provider별 사용량
 */
@Entity('ai_usage_logs')
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** openai | anthropic | gemini */
  @Index()
  @Column({ type: 'varchar', length: 32 })
  provider!: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  model!: string;

  /** keyword | matching | … */
  @Index()
  @Column({ type: 'varchar', length: 32 })
  task!: string;

  @Column({ type: 'int', default: 0, name: 'prompt_tokens' })
  promptTokens!: number;

  @Column({ type: 'int', default: 0, name: 'completion_tokens' })
  completionTokens!: number;

  @Column({ type: 'int', default: 0, name: 'total_tokens' })
  totalTokens!: number;

  /**
   * Prompt 기록 (길이 제한 스냅샷)
   * 전체 Prompt 가 아닌 감사·디버그용 preview
   */
  @Column({ type: 'text', nullable: true, name: 'prompt_preview' })
  promptPreview!: string | null;

  /** 응답 본문 preview (선택) */
  @Column({ type: 'text', nullable: true, name: 'response_preview' })
  responsePreview!: string | null;

  /** Response Time (ms) */
  @Column({ type: 'int', default: 0, name: 'response_time_ms' })
  responseTimeMs!: number;

  /** 추정 비용 USD */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 6,
    default: 0,
    name: 'cost_usd',
  })
  costUsd!: string;

  /** 성공 전 재시도 횟수 (0 = 첫 시도 성공) */
  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount!: number;

  @Column({ type: 'boolean', default: true })
  success!: boolean;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
