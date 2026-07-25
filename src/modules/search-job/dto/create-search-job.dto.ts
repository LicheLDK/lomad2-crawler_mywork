import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * BackOffice → Search Job 생성.
 * 주문 마스터는 보내지 않는다. orderNo 만 전달하고,
 * Search Server 가 Rental API Client 로 주문정보를 조회한다.
 */
export class CreateSearchJobDto {
  @ApiProperty({ example: '30001234', description: '주문번호 (BackOffice Master 키)' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  orderNo!: string;

  @ApiPropertyOptional({
    example: ['joonggonara', 'bungae', 'karrot'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sites?: string[];

  @ApiPropertyOptional({
    description: 'true(기본): 캐시 우선. false: 강제 크롤',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useCache?: boolean;
}
