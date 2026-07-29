import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { WORKFLOW_STATUSES } from '../investigation.workflow';
import type { InvestigationStatus } from '@/database/entities/investigation-case.entity';

export class UpdateInvestigationStatusDto {
  @ApiProperty({
    enum: WORKFLOW_STATUSES,
    example: 'Investigating',
    description: '허용 그래프 내 다음 상태 (동일 상태 재전송은 no-op)',
  })
  @IsIn(WORKFLOW_STATUSES)
  status!: InvestigationStatus;
}
