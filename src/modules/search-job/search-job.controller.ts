import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { ResendCallbackResponseDto } from './dto/resend-callback-response.dto';

@ApiTags('search-job')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('search-jobs')
export class SearchJobController {
  constructor(private readonly searchJobService: SearchJobService) {}

  @Post()
  @ApiOperation({
    summary:
      'Search Job 생성 (orderNo → Rental API, 또는 body.order 수동 스냅샷으로 즉시 검색)',
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

  @Post(':id/callback/resend')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'BackOffice callback 수동 재전송 (자동 재시도 없음). 이미 성공한 callback 은 409',
  })
  @ApiResponse({
    status: 200,
    description: '재전송 성공. callbackSentAt 갱신, callbackError null',
    type: ResendCallbackResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      '이미 성공 전송됨 (callbackSentAt 존재 & callbackError null). 중복 전송하지 않음',
  })
  @ApiResponse({
    status: 400,
    description: 'Job 상태가 completed/partial 아님, 또는 callback 비활성',
  })
  @ApiResponse({
    status: 502,
    description: '재전송 실패 — callbackError 에 원인 재기록',
  })
  resendCallback(@Param('id', ParseUUIDPipe) id: string) {
    return this.searchJobService.resendCallback(id);
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
