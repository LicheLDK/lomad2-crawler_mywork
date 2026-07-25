import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Prompt 변경 History — 버전 bump / 수정 시 스냅샷 저장
 * 향후 관리자 화면에서 이력·롤백용
 */
@Entity('ai_prompt_histories')
export class AiPromptHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  key!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'text', name: 'system_template' })
  systemTemplate!: string;

  @Column({ type: 'text', name: 'user_template' })
  userTemplate!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true, name: 'changed_by' })
  changedBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
