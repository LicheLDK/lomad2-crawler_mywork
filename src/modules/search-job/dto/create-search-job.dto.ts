import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 백오피스 주문 API 응답과 동일 포맷.
 * 연동 전 Postman 수동 테스트용 — body.order 로 전달하면 Rental API 조회를 건너뛴다.
 */
export class ManualOrderSnapshotDto {
  @ApiPropertyOptional({ example: '30008788' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  order_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  easyrental_contract_num?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  product_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  product_detail_code?: string;

  @ApiProperty({ example: '에어론 풀 체어 그라파이트' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  product_name!: string;

  @ApiPropertyOptional({ example: 'Herman Miller' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  option_name?: string;

  @ApiPropertyOptional({ example: 'Graphite' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourcing_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  thumbnail_img_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  count?: number;
}

/**
 * BackOffice → Search Job 생성.
 * - 운영: orderNo 만 전달 → Rental API 로 주문 조회
 * - 연동 전 수동 테스트: order 스냅샷을 함께 넣으면 Rental API 없이 검색
 */
export class CreateSearchJobDto {
  @ApiProperty({
    example: '30008788',
    description: '주문번호. order.order_id 가 있으면 생략 가능',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  orderNo?: string;

  @ApiPropertyOptional({
    description:
      '백오피스 주문 API와 동일 JSON. 있으면 Rental API 조회를 건너뛰고 이 값으로 검색',
    type: ManualOrderSnapshotDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ManualOrderSnapshotDto)
  order?: ManualOrderSnapshotDto;

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
