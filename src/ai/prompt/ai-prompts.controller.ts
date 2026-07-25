import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { PromptManagerService } from './prompt-manager.service';
import type { PromptUpdateInput } from './prompt.types';

/**
 * Prompt Management API — 관리자 화면 연동용 (UI 미구현)
 */
@ApiTags('ai-prompts')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('ai/prompts')
export class AiPromptsController {
  constructor(private readonly prompts: PromptManagerService) {}

  @Get()
  @ApiOperation({ summary: 'Prompt Tree (key · versions)' })
  tree() {
    return this.prompts.getPromptTree();
  }

  @Get('file-tree')
  @ApiOperation({ summary: '파일 시스템 Prompt Tree 텍스트' })
  fileTree() {
    return { tree: this.prompts.getFilePromptTreeText() };
  }

  @Get(':key')
  @ApiOperation({ summary: '활성 Prompt 본문' })
  getOne(@Param('key') key: string) {
    return this.prompts.getActive(key);
  }

  @Get(':key/versions')
  @ApiOperation({ summary: 'Prompt 버전 목록' })
  versions(@Param('key') key: string) {
    return this.prompts.listVersions(key);
  }

  @Get(':key/history')
  @ApiOperation({ summary: 'Prompt 변경 History' })
  history(@Param('key') key: string, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.prompts.getHistory(key, Number.isFinite(n) ? n : 50);
  }

  @Put(':key')
  @ApiOperation({
    summary: 'Prompt 수정 (새 version + History) — 관리자용',
  })
  update(@Param('key') key: string, @Body() body: PromptUpdateInput) {
    return this.prompts.updatePrompt(key, body);
  }
}
