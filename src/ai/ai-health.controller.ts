import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { AiService } from './ai.service';

@ApiTags('ai-health')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('ai')
export class AiHealthController {
  constructor(private readonly aiService: AiService) {}

  @Get('health')
  @ApiOperation({ summary: 'AI 엔진 상태 및 capabilities 조회' })
  getHealth() {
    return this.aiService.getHealthStatus();
  }
}
