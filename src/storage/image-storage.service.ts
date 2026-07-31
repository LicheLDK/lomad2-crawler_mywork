import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  assertSafeImageUrl,
  UnsafeImageUrlError,
} from '@/common/utils/safe-image-url.util';

const IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const SHARP_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif']);

@Injectable()
export class ImageStorageService {
  private readonly logger = new Logger(ImageStorageService.name);
  private readonly baseDir = join(process.cwd(), 'storage', 'images');

  constructor(private readonly config: ConfigService) {}

  async downloadAndStore(
    url: string,
    resultId: string,
  ): Promise<{ path: string; buffer: Buffer } | null> {
    try {
      await mkdir(this.baseDir, { recursive: true });
      const { buffer, contentType } = await this.fetchImageSafely(url);
      await this.assertDecodableImage(buffer);

      const ext = this.guessExt(url, contentType);
      const filename = `${resultId}${ext}`;
      const path = join(this.baseDir, filename);
      await writeFile(path, buffer);
      return { path, buffer };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Image store error: ${message} url=${url}`);
      return null;
    }
  }

  /**
   * Vision 등 외부 API용 — 이미지를 안전하게 받아 data URL로 변환.
   * 실패 시 null (호출측에서 원본 URL fallback 가능).
   */
  async fetchAsDataUrl(url: string): Promise<string | null> {
    try {
      const { buffer, contentType } = await this.fetchImageSafely(url);
      await this.assertDecodableImage(buffer);
      const mime = this.toMime(contentType);
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Image data-url error: ${message} url=${url}`);
      return null;
    }
  }

  private async fetchImageSafely(
    startUrl: string,
  ): Promise<{ buffer: Buffer; contentType: string | null }> {
    const maxBytes = this.config.get<number>('image.maxBytes') ?? 5 * 1024 * 1024;
    const timeoutMs = this.config.get<number>('image.timeoutMs') ?? 15000;
    const maxRedirects = this.config.get<number>('image.maxRedirects') ?? 3;
    const allowHttp = this.config.get<boolean>('image.allowHttp') ?? false;
    const allowHosts = this.config.get<string[]>('image.allowHosts') ?? [];

    let currentUrl = startUrl;

    for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
      await assertSafeImageUrl(currentUrl, { allowHttp, allowHosts });

      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: 'image/*,*/*;q=0.8',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new UnsafeImageUrlError('Redirect without Location header');
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        throw new Error(`Image download failed ${response.status}`);
      }

      const contentTypeRaw = response.headers.get('content-type');
      const contentType = contentTypeRaw?.split(';')[0]?.trim().toLowerCase() ?? null;
      if (contentType && !this.isAllowedContentType(contentType)) {
        throw new Error(`Blocked Content-Type: ${contentType}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const declared = Number(contentLength);
        if (Number.isFinite(declared) && declared > maxBytes) {
          throw new Error(`Image Content-Length exceeds limit (${declared})`);
        }
      }

      const buffer = await this.readBodyLimited(response, maxBytes);
      return { buffer, contentType };
    }

    throw new UnsafeImageUrlError(`Too many redirects (>${maxRedirects})`);
  }

  private isAllowedContentType(contentType: string): boolean {
    if (IMAGE_CONTENT_TYPES.has(contentType)) return true;
    // 일부 CDN은 application/octet-stream 으로 내려줌 → Sharp로 재판정
    return contentType === 'application/octet-stream';
  }

  private async readBodyLimited(
    response: Response,
    maxBytes: number,
  ): Promise<Buffer> {
    if (!response.body) {
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > maxBytes) {
        throw new Error(`Image body exceeds limit (${arrayBuffer.byteLength})`);
      }
      return Buffer.from(arrayBuffer);
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore cancel errors
        }
        throw new Error(`Image body exceeds limit (${total})`);
      }
      chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks, total);
  }

  private async assertDecodableImage(buffer: Buffer): Promise<void> {
     
    const sharp = require('sharp') as typeof import('sharp');
    const meta = await sharp(buffer, { failOn: 'error' }).metadata();
    if (!meta.format || !SHARP_FORMATS.has(meta.format)) {
      throw new Error(`Not a supported image format: ${meta.format ?? 'unknown'}`);
    }
  }

  private toMime(contentType: string | null): string {
    if (contentType === 'image/jpg') return 'image/jpeg';
    if (contentType && IMAGE_CONTENT_TYPES.has(contentType)) return contentType;
    return 'image/jpeg';
  }

  private guessExt(url: string, contentType: string | null): string {
    if (contentType?.includes('png')) return '.png';
    if (contentType?.includes('webp')) return '.webp';
    if (contentType?.includes('gif')) return '.gif';
    if (contentType?.includes('avif')) return '.avif';
    if (url.includes('.png')) return '.png';
    if (url.includes('.webp')) return '.webp';
    if (url.includes('.gif')) return '.gif';
    return '.jpg';
  }
}
