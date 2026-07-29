import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { InvestigationPriority } from '@/database/entities/investigation-case.entity';

const PRIORITIES = ['High', 'Medium', 'Low'] as const;

export class UpdateInvestigationDto {
  @ApiPropertyOptional({
    nullable: true,
    description: '담당자. null 이면 해제',
    example: 'kim',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(100)
  assignee?: string | null;

  @ApiPropertyOptional({ enum: PRIORITIES, example: 'High' })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: InvestigationPriority;

  @ApiPropertyOptional({
    nullable: true,
    description: '마감일 ISO8601. null 이면 해제',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  dueDate?: string | null;
}
