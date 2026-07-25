import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SearchJobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Search Job — BackOffice 주문에 대한 검색 실행 단위.
 *
 * BackOffice 가 Master. Search Server 는 주문 마스터를 관리하지 않는다.
 * - 영속: orderNo(참조 키) + 검색 실행 필드(keywords, status, progress …)
 * - 주문 상세(계약·고객·브랜드 …)는 Rental API Client 로 조회
 * - productName / productNo / referenceImageUrl 은 Job 실행 스냅샷(감사·재실행), 마스터 아님
 */
@Entity('search_jobs')
export class SearchJob {
  /** Job ID */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** BackOffice 주문 참조 키 (Master FK) */
  @Index()
  @Column({ type: 'varchar', length: 100 })
  orderNo!: string;

  /**
   * @deprecated 주문 마스터 복제 금지. 표시는 Rental API 조회.
   * 레거시 호환용 nullable 컬럼 — 신규 Job 은 null.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  contractNo!: string | null;

  /** @deprecated 주문 마스터 복제 금지. 신규 Job 은 null. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  customerName!: string | null;

  @Column({
    type: 'enum',
    enum: SearchJobStatus,
    enumName: 'search_job_status_enum',
    default: SearchJobStatus.PENDING,
  })
  status!: SearchJobStatus;

  /** Requested At */
  @CreateDateColumn({ type: 'timestamptz', name: 'requested_at' })
  requestedAt!: Date;

  // --- Search 실행 스냅샷 (마스터 아님) ---

  @Column({ type: 'varchar', length: 100, nullable: true })
  productNo!: string | null;

  /** 키워드 생성 시점의 상품명 스냅샷 */
  @Column({ type: 'varchar', length: 255, nullable: true })
  productName!: string | null;

  /** @deprecated 신규 Job 은 null — 키워드는 keywords[] 에만 반영 */
  @Column({ type: 'varchar', length: 100, nullable: true })
  brand!: string | null;

  /** @deprecated */
  @Column({ type: 'varchar', length: 100, nullable: true })
  modelName!: string | null;

  /** @deprecated */
  @Column({ type: 'varchar', length: 100, nullable: true })
  option!: string | null;

  /** @deprecated */
  @Column({ type: 'varchar', length: 100, nullable: true })
  color!: string | null;

  /** SearchKeywordGenerator 가 만든 검색어 목록 */
  @Column({ type: 'jsonb', default: [] })
  keywords!: string[];

  @Column({ type: 'varchar', length: 1000, nullable: true })
  referenceImageUrl!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  sites!: string[] | null;

  @Column({ type: 'boolean', default: true })
  useCache!: boolean;

  /** 연결된 기존 search_history.id */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  searchHistoryId!: string | null;

  /** 진행률 0~100 (Progress API / Progress Bar) */
  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  currentSite!: string | null;

  @Column({ type: 'int', default: 0 })
  resultCount!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  /** BackOffice 검색 완료 Callback 전송 시각 (중복 방지) */
  @Column({ type: 'timestamptz', nullable: true })
  callbackSentAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  callbackError!: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
