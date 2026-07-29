import { ApiProperty } from '@nestjs/swagger';

export class FailedJobItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  originalJobId!: string;

  @ApiProperty()
  jobName!: string;

  @ApiProperty()
  searchHistoryId!: string;

  @ApiProperty()
  keyword!: string;

  @ApiProperty()
  failedReason!: string;

  @ApiProperty()
  failedAt!: string;

  @ApiProperty()
  attemptsMade!: number;
}

export class FailedJobsResponseDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [FailedJobItemDto] })
  items!: FailedJobItemDto[];
}

export class RetryFailedJobResponseDto {
  @ApiProperty({ description: '재등록된 crawl job id' })
  jobId!: string;
}
