import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CrawlerResult } from './crawler-result.entity';

@Entity('crawler_site')
export class CrawlerSite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  baseUrl!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'int', default: 5 })
  priority!: number;

  @Column({ type: 'jsonb', nullable: true })
  config!: Record<string, unknown> | null;

  @OneToMany(() => CrawlerResult, (result) => result.site)
  results!: CrawlerResult[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
