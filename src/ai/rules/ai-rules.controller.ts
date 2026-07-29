import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { AiRuleEngineService } from './ai-rule-engine.service';
import { UpdateRuleDto, UpdateCreateThresholdDto } from './dto/update-rule.dto';

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

  @Patch('create-threshold')
  @ApiOperation({ summary: 'create_investigation 임계값 빠른 변경' })
  async updateCreateThreshold(@Body() dto: UpdateCreateThresholdDto) {
    const updated = await this.ruleEngine.updateCreateThreshold(dto.threshold);
    return { threshold: updated.value, code: updated.code };
  }

  @Patch(':code')
  @ApiOperation({ summary: '규칙 활성/비활성 토글 및 value 업데이트' })
  async updateRule(@Param('code') code: string, @Body() dto: UpdateRuleDto) {
    return this.ruleEngine.updateRule(code, dto);
  }
}
