import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AiRuleField =
  | 'aiScore'
  | 'matchingScore'
  | 'priceDiffPercent'
  | 'titleSimilarity'
  | 'imageSimilarity';

export type AiRuleOperator = 'gte' | 'lte' | 'gt' | 'lt' | 'eq';

export type AiRuleAction =
  | 'create_investigation'
  | 'exclude'
  | 'warning';

/**
 * AI Rule — DB 관리 (Config seed / AI_RULES_JSON 로 초기화)
 * 하드코딩된 분기 대신 이 테이블(또는 Config)을 평가한다.
 */
@Entity('ai_rules')
export class AiRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 안정적 식별자 예: auto_create_high_score */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** 높을수록 먼저 평가 (exclude 권장 200+) */
  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ type: 'varchar', length: 64 })
  field!: AiRuleField | string;

  @Column({ type: 'varchar', length: 16 })
  operator!: AiRuleOperator | string;

  /** 비교 값 (예: 90, 50, 70) */
  @Column({ type: 'double precision' })
  value!: number;

  @Column({ type: 'varchar', length: 64 })
  action!: AiRuleAction | string;

  /** Warning / Timeline 메시지 */
  @Column({ type: 'varchar', length: 512, nullable: true })
  message!: string | null;

  /** config | db | seed */
  @Column({ type: 'varchar', length: 32, default: 'config' })
  source!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
