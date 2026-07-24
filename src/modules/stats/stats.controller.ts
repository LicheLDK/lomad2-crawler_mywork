import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  getOverview() {
    return this.statsService.getOverview();
  }
}
