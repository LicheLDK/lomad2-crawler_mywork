import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CrawlerResult } from './crawler-result.entity';
import { SearchHistory } from './search-history.entity';

/**
 * 검색 이력 × 매물(listing) 스냅샷.
 * 동일 URL이 다른 검색에서 다시 잡혀도 과거 검색 결과가 유실되지 않도록
 * N:M으로 연결하고, 당시 title/price/유사도를 보존한다.
 */
@Entity('search_history_results')
@Unique(['searchHistoryId', 'resultId'])
@Index(['searchHistoryId'])
@Index(['resultId'])
export class SearchHistoryResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  searchHistoryId!: string;

  @ManyToOne(() => SearchHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'searchHistoryId' })
  searchHistory!: SearchHistory;

  @Column({ type: 'uuid' })
  resultId!: string;

  @ManyToOne(() => CrawlerResult, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resultId' })
  result!: CrawlerResult;

  /** 검색 시점 스냅샷 */
  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'bigint', nullable: true })
  price!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  seller!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region!: string | null;

  @Column({ type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'float', default: 0 })
  titleSimilarity!: number;

  @Column({ type: 'float', default: 0 })
  imageSimilarity!: number;

  /** AI Matching Engine — 0~100 (P0 영속화) */
  @Column({ type: 'float', nullable: true })
  matchingScore!: number | null;

  /** AI Matching Engine — 0~100 */
  @Column({ type: 'float', nullable: true })
  aiScore!: number | null;

  @Column({ type: 'text', nullable: true })
  matchingReason!: string | null;

  /** 항목별 점수 JSON (brand/model/productName/…) */
  @Column({ type: 'jsonb', nullable: true })
  matchingScores!: Record<string, number> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
