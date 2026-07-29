import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { CreateSearchDto } from './dto/create-search.dto';
import { QueryResultDto } from './dto/query-result.dto';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';

@ApiTags('search')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('search')
  @ApiOperation({
    summary: '상품명 검색 (Elastic 캐시 → 없으면 Crawl Queue)',
  })
  @ApiResponse({ status: 201, description: '검색 요청 접수' })
  create(@Body() dto: CreateSearchDto) {
    return this.searchService.search(dto);
  }

  @Get('search/:id')
  @ApiOperation({ summary: '검색 이력/상태 조회' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.searchService.getSearch(id);
  }

  @Delete('search/:id')
  @ApiOperation({
    summary:
      '검색 이력 삭제 (연관 Investigation 삭제, SearchJob 연결 해제, orphan 매물 정리)',
  })
  @ApiResponse({ status: 200, description: '삭제 완료' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.searchService.deleteSearch(id);
  }

  @Get('result')
  @ApiOperation({ summary: '크롤 결과 목록 조회' })
  getResults(@Query() query: QueryResultDto) {
    return this.searchService.getResults(query);
  }
}
