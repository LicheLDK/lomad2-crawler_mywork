import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type InvestigationStatus =
  | 'Open'
  | 'Investigating'
  | 'Review'
  | 'Completed'
  | 'Archived';

export type InvestigationPriority = 'High' | 'Medium' | 'Low';

export interface InvestigationTimelineEvent {
  id: string;
  kind: string;
  at: string;
  title: string;
  detail?: string | null;
}

export interface InvestigationAiAnalysis {
  imageSimilarity: number;
  titleSimilarity: number;
  brandMatch: number;
  modelMatch: number;
  priceSimilarity: number;
  ocrMatch: number;
}

/** 조사 메모 (jsonb notes 배열 요소) */
export interface InvestigationNote {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

@Entity('investigation_cases')
export class InvestigationCaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  caseNo!: string;

  @Column({ type: 'varchar', length: 500 })
  productName!: string;

  /** 0~1 */
  @Column({ type: 'float', default: 0 })
  aiScore!: number;

  @Column({ type: 'varchar', length: 30, default: 'Open' })
  status!: InvestigationStatus;

  @Column({ type: 'varchar', length: 20, default: 'Medium' })
  priority!: InvestigationPriority;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assignee!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  siteCode!: string;

  @Column({ type: 'text', nullable: true })
  url!: string | null;

  @Column({ type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  price!: string | null;

  /** crawler_result.id — 동일 매물 중복 생성 방지 */
  @Index({ unique: true })
  @Column({ type: 'uuid', nullable: true, name: 'result_id' })
  resultId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  searchHistoryId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  searchJobId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  orderNo!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  contractNo!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customerName!: string | null;

  /**
   * 주문 상품명 (Order Mapping 필수 항목).
   * listingTitle 은 중고 매물 제목.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  orderProductName!: string | null;

  /** 중고 매물 제목 (크롤 결과) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  listingTitle!: string | null;

  @Column({ type: 'boolean', default: false })
  autoCreated!: boolean;

  @Column({ type: 'jsonb', default: [] })
  timeline!: InvestigationTimelineEvent[];

  @Column({ type: 'jsonb', nullable: true })
  aiAnalysis!: InvestigationAiAnalysis | null;

  /** 메모 배열 — D-3 워크플로 필드 (쓰기 API 는 D-4) */
  @Column({ type: 'jsonb', default: [] })
  notes!: InvestigationNote[];

  /** 최종 판단 코드 (예: resale_confirmed) */
  @Column({ type: 'varchar', length: 50, nullable: true })
  finalDecision!: string | null;

  /** 최종 판단 메모 */
  @Column({ type: 'text', nullable: true })
  finalDecisionNote!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
