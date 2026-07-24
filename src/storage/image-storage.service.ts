import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class ImageStorageService {
  private readonly logger = new Logger(ImageStorageService.name);
  private readonly baseDir = join(process.cwd(), 'storage', 'images');

  async downloadAndStore(
    url: string,
    resultId: string,
  ): Promise<{ path: string; buffer: Buffer } | null> {
    try {
      await mkdir(this.baseDir, { recursive: true });
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        this.logger.warn(`Image download failed ${response.status}: ${url}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = this.guessExt(url, response.headers.get('content-type'));
      const filename = `${resultId}${ext}`;
      const path = join(this.baseDir, filename);
      await writeFile(path, buffer);
      return { path, buffer };
    } catch (error) {
      this.logger.warn(
        `Image store error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private guessExt(url: string, contentType: string | null): string {
    if (contentType?.includes('png')) return '.png';
    if (contentType?.includes('webp')) return '.webp';
    if (contentType?.includes('gif')) return '.gif';
    if (url.includes('.png')) return '.png';
    if (url.includes('.webp')) return '.webp';
    return '.jpg';
  }
}
