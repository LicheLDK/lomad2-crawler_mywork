import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInvestigationNoteDto {
  @ApiProperty({ example: '매물 사진과 주문 이미지 대조 필요' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({ example: '담당자', default: '담당자' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  author?: string;
}
