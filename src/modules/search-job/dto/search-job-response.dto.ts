import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 키워드별 검색 내역 (search_job_histories) */
export class KeywordHistoryItemDto {
  @ApiPropertyOptional({
    nullable: true,
    description: '검색 키워드 (backfill 시 null 가능)',
    example: 'Galaxy S24 Ultra',
  })
  keyword!: string | null;

  @ApiProperty({
    description: '개별 검색 상태',
    example: 'completed',
  })
  status!: string;

  @ApiProperty({
    description: '해당 키워드가 찾은 매물 수 (키워드별 합계 ≠ Job resultCount 가 정상)',
    example: 12,
  })
  resultCount!: number;

  @ApiProperty({
    description: '연결된 search_history.id',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  searchHistoryId!: string;
}

/**
 * GET /search-jobs/:id 응답.
 * 기존 필드는 유지하고 keywordHistories 만 추가한다 (백오피스 호환).
 */
export class SearchJobDetailResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty()
  orderNo!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  requestedAt!: Date;

  @ApiProperty({ type: [String] })
  keywords!: string[];

  @ApiPropertyOptional({
    nullable: true,
    description: '대표(첫) 크롤 히스토리 — @deprecated, keywordHistories 사용 권장',
  })
  searchHistoryId!: string | null;

  @ApiProperty()
  progress!: number;

  @ApiPropertyOptional({ nullable: true })
  currentSite!: string | null;

  @ApiProperty({
    description:
      '고유 매물 수 (distinct resultId). 키워드별 resultCount 합계와 다를 수 있음',
  })
  resultCount!: number;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  finishedAt!: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'BackOffice callback 성공 전송 시각',
  })
  callbackSentAt!: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'BackOffice callback 실패 메시지 (성공 시 null)',
  })
  callbackError!: string | null;

  @ApiPropertyOptional({ nullable: true })
  productNameSnapshot!: string | null;

  @ApiPropertyOptional({ nullable: true })
  productNoSnapshot!: string | null;

  @ApiProperty({
    type: [KeywordHistoryItemDto],
    description: '키워드별 검색 내역. Job resultCount는 고유 매물 기준',
  })
  keywordHistories!: KeywordHistoryItemDto[];
}

/**
 * GET /search-jobs/:id/progress 응답.
 * 기존 필드 유지 + keywordHistories 추가.
 */
export class SearchJobProgressResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  currentSite!: string | null;

  @ApiProperty()
  progress!: number;

  @ApiProperty({
    description: '고유 매물 수 (키워드별 합계와 다를 수 있음)',
  })
  resultCount!: number;

  @ApiPropertyOptional({ nullable: true })
  searchHistoryId!: string | null;

  @ApiPropertyOptional()
  message?: string;

  @ApiProperty()
  at!: string;

  @ApiProperty({
    type: [KeywordHistoryItemDto],
    description: '키워드별 검색 내역',
  })
  keywordHistories!: KeywordHistoryItemDto[];
}
