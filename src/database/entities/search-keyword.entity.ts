import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SearchHistory } from './search-history.entity';

@Entity('search_keyword')
export class SearchKeyword {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  keyword!: string;

  @Column({ type: 'int', default: 1 })
  searchCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastSearchedAt!: Date | null;

  @OneToMany(() => SearchHistory, (history) => history.keywordEntity)
  histories!: SearchHistory[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
