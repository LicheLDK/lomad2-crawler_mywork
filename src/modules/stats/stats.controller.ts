import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { StatsService } from './stats.service';

@ApiTags('stats')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({ summary: '대시보드 통계 요약' })
  @ApiQuery({
    name: 'hours',
    required: false,
    description: 'siteMetrics 집계 창 (기본 24, 최대 168)',
    example: 24,
  })
  getOverview(@Query('hours') hours?: string) {
    const parsed = hours != null ? parseInt(hours, 10) : 24;
    const metricsHours =
      Number.isFinite(parsed) && parsed > 0 && parsed <= 168 ? parsed : 24;
    return this.statsService.getOverview(metricsHours);
  }
}
