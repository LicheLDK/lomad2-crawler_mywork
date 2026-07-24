import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { CrawlService } from './crawl.service';
import { CreateCrawlDto } from './dto/create-crawl.dto';

@ApiTags('crawl')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('crawl')
export class CrawlController {
  constructor(private readonly crawlService: CrawlService) {}

  @Post()
  @ApiOperation({ summary: '캐시 무시하고 강제 크롤 실행' })
  create(@Body() dto: CreateCrawlDto) {
    return this.crawlService.enqueue(dto);
  }

  @Get('sites')
  @ApiOperation({ summary: '지원 사이트 목록' })
  sites() {
    return this.crawlService.listSites();
  }
}
