import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSearchDto {
  @ApiProperty({ example: '시몬스 침대 퀸' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  keyword!: string;

  @ApiPropertyOptional({ example: 'PROD-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalProductId?: string;

  @ApiPropertyOptional({
    example: ['joonggonara', 'bungae', 'karrot'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sites?: string[];

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxResultsPerSite?: number;

  @ApiPropertyOptional({
    description:
      "검색 광역 지역 코드. 'all' 또는 생략 시 전체. 예: seoul, gyeonggi, incheon",
    example: ['all'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regions?: string[];

  @ApiPropertyOptional({
    description: '참고 이미지 URL (유사도 계산용)',
  })
  @IsOptional()
  @IsUrl()
  referenceImageUrl?: string;

  @ApiPropertyOptional({
    description: '캐시된 Elastic 결과가 있으면 즉시 반환',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useCache?: boolean;

  @ApiPropertyOptional({
    description: '캐시만 조회하고 크롤을 실행하지 않음',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  cacheOnly?: boolean;
}
