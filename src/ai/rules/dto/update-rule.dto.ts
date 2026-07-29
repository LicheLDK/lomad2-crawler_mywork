import { IsBoolean, IsNumber, IsObject, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRuleDto {
  @ApiPropertyOptional({ description: '규칙 활성/비활성' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'threshold 등 value 객체',
    example: { value: 85 },
  })
  @IsOptional()
  @IsObject()
  value?: Record<string, any>;
}

export class UpdateCreateThresholdDto {
  @ApiPropertyOptional({ description: 'create_investigation 임계값 (0~100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  threshold!: number;
}
