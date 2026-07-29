import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { InvestigationService } from './investigation.service';
import { CreateFinalDecisionDto } from './dto/create-final-decision.dto';
import { CreateInvestigationDto } from './dto/create-investigation.dto';
import { CreateInvestigationNoteDto } from './dto/create-investigation-note.dto';
import { UpdateInvestigationDto } from './dto/update-investigation.dto';
import { UpdateInvestigationNoteDto } from './dto/update-investigation-note.dto';
import { UpdateInvestigationStatusDto } from './dto/update-investigation-status.dto';

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

  @Get('stats')
  @ApiOperation({
    summary: 'Investigation 집계 (Overview용)',
    description: 'last24h 케이스 수 + 상태별 건수',
  })
  getStats() {
    return this.investigationService.getStats();
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Investigation 수동 생성',
    description:
      'resultId 가 이미 있으면 새 row 없이 기존 케이스를 200 으로 반환한다.',
  })
  create(@Body() dto: CreateInvestigationDto) {
    return this.investigationService.createManual(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '상태 전이 (허용 그래프 검증)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvestigationStatusDto,
  ) {
    return this.investigationService.updateStatus(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '담당·우선순위·마감일 수정' })
  updateAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvestigationDto,
  ) {
    return this.investigationService.updateAssignment(id, dto);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: '메모 추가' })
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInvestigationNoteDto,
  ) {
    return this.investigationService.addNote(id, dto);
  }

  @Patch(':id/notes/:noteId')
  @ApiOperation({ summary: '메모 수정' })
  updateNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateInvestigationNoteDto,
  ) {
    return this.investigationService.updateNote(id, noteId, dto);
  }

  @Delete(':id/notes/:noteId')
  @ApiOperation({ summary: '메모 삭제' })
  deleteNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    return this.investigationService.deleteNote(id, noteId);
  }

  @Post(':id/final-decision')
  @ApiOperation({
    summary: '최종 판단',
    description: 'decision 저장 + Completed + decidedAt (이미 Completed 면 idempotent)',
  })
  applyFinalDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFinalDecisionDto,
  ) {
    return this.investigationService.applyFinalDecision(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Investigation Case 상세' })
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.investigationService.getOne(id);
    if (!row) throw new NotFoundException(`Investigation not found: ${id}`);
    return row;
  }
}
