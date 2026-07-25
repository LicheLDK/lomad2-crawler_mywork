import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { InvestigationService } from './investigation.service';

@ApiTags('investigation')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('investigations')
export class InvestigationController {
  constructor(private readonly investigationService: InvestigationService) {}

  @Get()
  @ApiOperation({ summary: 'Investigation Case 목록' })
  list(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.investigationService.list(Number.isFinite(n) ? n : 50);
  }

  @Get('config')
  @ApiOperation({ summary: 'Investigation 자동 생성 설정 (AI Rule 기준)' })
  async config() {
    return {
      aiScoreThreshold: await this.investigationService.getAiScoreThreshold(),
      autoCreateEnabled: this.investigationService.isAutoCreateEnabled(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Investigation Case 상세' })
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.investigationService.getOne(id);
    if (!row) throw new NotFoundException(`Investigation not found: ${id}`);
    return row;
  }
}
