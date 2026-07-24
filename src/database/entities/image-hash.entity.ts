import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CrawlerResult } from './crawler-result.entity';

@Entity('image_hash')
export class ImageHash {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => CrawlerResult, (result) => result.imageHash, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'result_id' })
  result!: CrawlerResult;

  @Column({ type: 'uuid' })
  resultId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  phash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  dhash!: string | null;

  @Column({ type: 'text', nullable: true })
  localPath!: string | null;

  @Column({ type: 'text', nullable: true })
  sourceUrl!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
