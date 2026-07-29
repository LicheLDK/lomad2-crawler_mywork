import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SearchJob } from './search-job.entity';

/**
 * Search Job × SearchHistory 연결 (1:N).
 * 키워드별 크롤 히스토리를 Job 단위로 추적한다.
 */
@Entity('search_job_histories')
@Unique(['searchJobId', 'searchHistoryId'])
@Index(['searchJobId'])
export class SearchJobHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  searchJobId!: string;

  @ManyToOne(() => SearchJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'searchJobId' })
  searchJob!: SearchJob;

  /** 해당 히스토리를 만든 키워드 (backfill 시 비어 있을 수 있음) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  keyword!: string | null;

  /** search_history.id 참조 (기존 관행대로 FK 엔티티 관계는 두지 않음) */
  @Column({ type: 'uuid' })
  searchHistoryId!: string;

  /** 개별 검색 상태 (queued/running/completed/partial/failed/cached 등) */
  @Column({ type: 'varchar', length: 50 })
  status!: string;

  @Column({ type: 'int', default: 0 })
  resultCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
