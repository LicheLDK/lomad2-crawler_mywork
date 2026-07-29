import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const FINAL_DECISIONS = [
  'resale_confirmed',
  'further_investigation',
  'false_positive',
  'excluded',
] as const;

export type FinalDecisionCode = (typeof FINAL_DECISIONS)[number];

export class CreateFinalDecisionDto {
  @ApiProperty({
    enum: FINAL_DECISIONS,
    example: 'resale_confirmed',
  })
  @IsIn(FINAL_DECISIONS)
  decision!: FinalDecisionCode;

  @ApiPropertyOptional({ example: '판매자 확인 완료' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
