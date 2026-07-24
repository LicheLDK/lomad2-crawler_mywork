import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CrawlerSite } from './crawler-site.entity';
import { SearchHistory } from './search-history.entity';
import { ImageHash } from './image-hash.entity';

@Entity('crawler_result')
@Index(['url'], { unique: true })
export class CrawlerResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SearchHistory, (history) => history.results, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'search_history_id' })
  searchHistory!: SearchHistory | null;

  @Column({ type: 'uuid', nullable: true })
  searchHistoryId!: string | null;

  @ManyToOne(() => CrawlerSite, (site) => site.results, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'site_id' })
  site!: CrawlerSite | null;

  @Column({ type: 'uuid', nullable: true })
  siteId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  siteCode!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'bigint', nullable: true })
  price!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  seller!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region!: string | null;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  contentHash!: string | null;

  @Column({ type: 'float', nullable: true })
  titleSimilarity!: number | null;

  @Column({ type: 'float', nullable: true })
  imageSimilarity!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  listedAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  raw!: Record<string, unknown> | null;

  @OneToOne(() => ImageHash, (hash) => hash.result, { cascade: true })
  imageHash!: ImageHash | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
