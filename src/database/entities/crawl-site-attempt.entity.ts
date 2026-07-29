import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 사이트별 크롤 시도 기록 (운영 관측용).
 * 집계 API는 B-4. 이 엔티티는 append-only 기록만 담당한다.
 */
@Entity('crawl_site_attempts')
@Index(['siteCode', 'createdAt'])
@Index(['searchHistoryId'])
export class CrawlSiteAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** search_history.id 참조 (FK는 마이그레이션에만 두고 엔티티 관계는 생략) */
  @Column({ type: 'uuid' })
  searchHistoryId!: string;

  @Column({ type: 'varchar', length: 50 })
  siteCode!: string;

  @Column({ type: 'boolean' })
  success!: boolean;

  @Column({ type: 'int' })
  durationMs!: number;

  @Column({ type: 'int', default: 0 })
  resultCount!: number;

  /** 예: HTTP_403, PARSE_EMPTY, TIMEOUT */
  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'int', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'varchar', length: 32 })
  adapterVersion!: string;

  /** 감사·디버그용 (truncate) */
  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
