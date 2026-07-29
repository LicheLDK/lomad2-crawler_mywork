import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInvestigationDto {
  @ApiProperty({
    description: 'crawler_result.id — 동일 resultId 가 있으면 기존 케이스 반환(200)',
    format: 'uuid',
  })
  @IsUUID()
  resultId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  searchHistoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  searchJobId?: string;

  @ApiPropertyOptional({
    example: '30001234',
    description: '주문번호 (job 에 없을 때 수동 지정)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  orderNo?: string;
}
