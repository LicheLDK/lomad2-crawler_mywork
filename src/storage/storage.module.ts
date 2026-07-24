import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageHash } from '@/database/entities/image-hash.entity';
import { ImageStorageService } from './image-storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ImageHash])],
  controllers: [StorageController],
  providers: [ImageStorageService],
  exports: [ImageStorageService],
})
export class StorageModule {}
