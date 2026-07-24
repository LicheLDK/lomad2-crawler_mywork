import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCrawlDto {
  @ApiProperty({ example: '시몬스 침대' })
  @IsString()
  keyword!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sites?: string[];

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxResultsPerSite?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalProductId?: string;
}
