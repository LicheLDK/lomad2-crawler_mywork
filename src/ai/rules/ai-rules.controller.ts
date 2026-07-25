import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { AiRuleEngineService } from './ai-rule-engine.service';

/**
 * AI Rules API — 관리/확인용 (UI 미구현)
 */
@ApiTags('ai-rules')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('ai/rules')
export class AiRulesController {
  constructor(private readonly ruleEngine: AiRuleEngineService) {}

  @Get()
  @ApiOperation({ summary: 'AI Rule 목록 (DB)' })
  list() {
    return this.ruleEngine.listAll();
  }

  @Get('active')
  @ApiOperation({ summary: '활성 AI Rule (평가에 사용)' })
  active() {
    return this.ruleEngine.getActiveRules();
  }

  @Get('create-threshold')
  @ApiOperation({ summary: 'create_investigation 임계값' })
  async createThreshold() {
    return { threshold: await this.ruleEngine.getCreateThreshold() };
  }
}
