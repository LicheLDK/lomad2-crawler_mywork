import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { SearchJobService } from './search-job.service';
import { CreateSearchJobDto } from './dto/create-search-job.dto';
import {
  SearchJobDetailResponseDto,
  SearchJobProgressResponseDto,
} from './dto/search-job-response.dto';

@ApiTags('search-job')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('search-jobs')
export class SearchJobController {
  constructor(private readonly searchJobService: SearchJobService) {}

  @Post()
  @ApiOperation({
    summary:
      'Search Job 생성 (orderNo only → Rental API 조회 → 즉시 jobId, 검색 비동기)',
  })
  @ApiResponse({ status: 201, description: 'Job 생성됨' })
  create(@Body() dto: CreateSearchJobDto) {
    return this.searchJobService.create(dto);
  }

  @Get('rental/recent')
  @ApiOperation({
    summary: 'Rental Page — 최근 Search Job (Status · Progress · Inv count)',
  })
  listRecentJobs(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 40;
    return this.searchJobService.listRecentJobs(Number.isFinite(n) ? n : 40);
  }

  @Get('rental/jobs/:jobId')
  @ApiOperation({
    summary:
      'Rental Page — Job 상세 (Order via Rental API · History · Investigation). job.keywordHistories 포함',
  })
  getRentalJobDetail(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.searchJobService.getRentalJobDetail(jobId);
  }

  @Get(':id/progress')
  @ApiOperation({
    summary:
      'Search Job 진행률 (Status · Current Site · Progress · Result Count · keywordHistories)',
  })
  @ApiResponse({
    status: 200,
    description:
      '기존 필드 유지 + keywordHistories. resultCount는 고유 매물 기준(키워드별 합계와 다를 수 있음)',
    type: SearchJobProgressResponseDto,
  })
  getProgress(@Param('id', ParseUUIDPipe) id: string) {
    return this.searchJobService.getProgress(id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Search Job 상태 조회 (키워드별 내역 keywordHistories 포함)',
  })
  @ApiResponse({
    status: 200,
    description:
      '기존 필드 유지 + keywordHistories. resultCount는 고유 매물 수(키워드별 합계와 다를 수 있음)',
    type: SearchJobDetailResponseDto,
  })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.searchJobService.getOne(id);
  }
}
