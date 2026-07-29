import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { CrawlQueueService } from './crawl-queue.service';
import {
  FailedJobsResponseDto,
  RetryFailedJobResponseDto,
} from './dto/queue-failed.dto';

@ApiTags('queue')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('queue')
export class QueueController {
  constructor(private readonly crawlQueue: CrawlQueueService) {}

  @Get('failed')
  @ApiOperation({
    summary: '재시도 소진된 crawl job (DLQ) 목록',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '최대 건수 (기본 50, 최대 100)',
    example: 50,
  })
  @ApiResponse({ status: 200, type: FailedJobsResponseDto })
  listFailed(@Query('limit') limit?: string) {
    const parsed = limit != null ? parseInt(limit, 10) : 50;
    const n = Number.isFinite(parsed) ? parsed : 50;
    return this.crawlQueue.listFailedJobs(n);
  }

  @Post(':id/retry')
  @HttpCode(200)
  @ApiOperation({
    summary: 'DLQ job 재실행 (동일 payload로 crawl queue 재등록)',
  })
  @ApiResponse({ status: 200, type: RetryFailedJobResponseDto })
  @ApiResponse({ status: 404, description: 'DLQ job 없음' })
  retryFailed(@Param('id') id: string) {
    return this.crawlQueue.retryFailedJob(id);
  }
}
