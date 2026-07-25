import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * AI Prompt 활성/버전 본문
 * 파일 templates/ 에서 seed, 관리자 수정 시 DB가 우선
 */
@Entity('ai_prompt_versions')
@Index(['key', 'version'], { unique: true })
export class AiPromptVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  key!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', name: 'system_template' })
  systemTemplate!: string;

  @Column({ type: 'text', name: 'user_template' })
  userTemplate!: string;

  /** 동일 key 중 활성 버전 (하나만 true) */
  @Column({ type: 'boolean', default: false })
  active!: boolean;

  /** file | admin */
  @Column({ type: 'varchar', length: 32, default: 'file' })
  source!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
