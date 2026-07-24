import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SearchKeyword } from './search-keyword.entity';
import { CrawlerResult } from './crawler-result.entity';

export enum SearchStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
  CACHED = 'cached',
}

@Entity('search_history')
export class SearchHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  keyword!: string;

  @ManyToOne(() => SearchKeyword, (kw) => kw.histories, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'keyword_id' })
  keywordEntity!: SearchKeyword | null;

  @Column({ type: 'uuid', nullable: true })
  keywordId!: string | null;

  /** Laravel 상품 ID 등 외부 참조 */
  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  externalProductId!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  sites!: string[] | null;

  @Column({
    type: 'enum',
    enum: SearchStatus,
    enumName: 'search_history_status_enum',
    default: SearchStatus.PENDING,
  })
  status!: SearchStatus;

  @Column({ type: 'int', default: 0 })
  resultCount!: number;

  @Column({ type: 'jsonb', nullable: true })
  requestMeta!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @OneToMany(() => CrawlerResult, (result) => result.searchHistory)
  results!: CrawlerResult[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
