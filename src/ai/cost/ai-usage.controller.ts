import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { AiCostService } from './ai-cost.service';

/**
 * AI Cost / Usage API — Dashboard 연동용 (UI 미구현)
 * GET /ai/usage/summary → 오늘 사용량 · 월간 비용 · Provider별
 */
@ApiTags('ai-usage')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('ai/usage')
export class AiUsageController {
  constructor(private readonly costService: AiCostService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'AI 비용 Dashboard 요약 (오늘 / 월간 / Provider별)',
  })
  getSummary() {
    return this.costService.getDashboardSummary();
  }

  @Get('today')
  @ApiOperation({ summary: '오늘 AI 사용량' })
  getToday() {
    return this.costService.getTodayUsage();
  }

  @Get('monthly')
  @ApiOperation({ summary: '월간 AI 비용' })
  @ApiQuery({ name: 'yearMonth', required: false, example: '2026-07' })
  getMonthly(@Query('yearMonth') yearMonth?: string) {
    return this.costService.getMonthlyCost(yearMonth);
  }

  @Get('by-provider')
  @ApiOperation({ summary: 'Provider별 AI 사용량 (기본: 이번 달)' })
  getByProvider() {
    return this.costService.getUsageByProvider();
  }
}
