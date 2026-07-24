import { Controller, Delete, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { CacheService } from './cache.service';

@ApiTags('cache')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('cache')
export class CacheController {
  constructor(private readonly cache: CacheService) {}

  @Delete()
  @ApiOperation({ summary: '검색 캐시(Redis) 삭제' })
  async clear() {
    const result = await this.cache.flushSearchCache();
    return { success: true, ...result };
  }
}
