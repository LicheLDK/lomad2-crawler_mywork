import { existsSync } from 'fs';
import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { ImageHash } from '@/database/entities/image-hash.entity';

/**
 * 크롤 저장 이미지 서빙 (img 태그용 — API Key 불필요)
 * GET /api/storage/images/:resultId
 */
@Controller('storage')
export class StorageController {
  constructor(
    @InjectRepository(ImageHash)
    private readonly imageHashRepo: Repository<ImageHash>,
  ) {}

  @Get('images/:resultId')
  async serveImage(
    @Param('resultId') resultId: string,
    @Res() res: Response,
  ) {
    const hash = await this.imageHashRepo.findOne({ where: { resultId } });
    if (!hash?.localPath || !existsSync(hash.localPath)) {
      throw new NotFoundException('Stored image not found');
    }
    return res.sendFile(hash.localPath);
  }
}
