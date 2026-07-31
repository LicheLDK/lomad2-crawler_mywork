import { Logger } from '@nestjs/common';
import type { LocalLooksSameScore } from './local-image.types';

export interface LooksSameCompareOptions {
  threshold: number;
  strict: boolean;
  tolerance: number;
  ignoreAntialiasing: boolean;
  backgroundHex?: string;
}

const logger = new Logger('LooksSameCompare');

/** looks-same 픽셀 유사도 비교 (비용 0). */
export async function compareLooksSame(
  imageA: Buffer,
  imageB: Buffer,
  options: LooksSameCompareOptions,
): Promise<LocalLooksSameScore> {
  const threshold = options.threshold;

  try {
    const looksSame = require('looks-same') as typeof import('looks-same');
    const [normalizedA, normalizedB] = await ensureSameDimensions(
      imageA,
      imageB,
      options.backgroundHex ?? 'ffffff',
    );

    const result = await looksSame(normalizedA, normalizedB, {
      strict: options.strict,
      tolerance: options.tolerance,
      ignoreAntialiasing: options.ignoreAntialiasing,
      ignoreCaret: true,
      createDiffImage: true,
    });

    const totalPixels = result.totalPixels || 0;
    const differentPixels = result.differentPixels || 0;
    const differenceRatio =
      totalPixels > 0 ? differentPixels / totalPixels : result.equal ? 0 : 1;
    const difference = Math.round(differenceRatio * 1000) / 10;
    const similarity = Math.round((1 - differenceRatio) * 1000) / 10;

    return {
      similarity,
      equal: result.equal,
      difference,
      threshold,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`LooksSame compare failed: ${message}`);
    return {
      similarity: 0,
      equal: false,
      difference: 100,
      threshold,
      skipped: true,
      error: message,
    };
  }
}

async function ensureSameDimensions(
  imageA: Buffer,
  imageB: Buffer,
  backgroundHex: string,
): Promise<[Buffer, Buffer]> {
  const sharp = require('sharp') as typeof import('sharp');
  const [metaA, metaB] = await Promise.all([
    sharp(imageA, { failOn: 'error' }).metadata(),
    sharp(imageB, { failOn: 'error' }).metadata(),
  ]);

  const widthA = metaA.width ?? 0;
  const heightA = metaA.height ?? 0;
  const widthB = metaB.width ?? 0;
  const heightB = metaB.height ?? 0;

  if (!widthA || !heightA || !widthB || !heightB) {
    throw new Error('LooksSame: unable to read image dimensions');
  }

  if (widthA === widthB && heightA === heightB) {
    return [imageA, imageB];
  }

  const targetWidth = Math.max(widthA, widthB);
  const targetHeight = Math.max(heightA, heightB);
  const bg = parseRgb(backgroundHex);

  const resizeToPng = async (buf: Buffer): Promise<Buffer> =>
    sharp(buf, { failOn: 'error' })
      .resize(targetWidth, targetHeight, {
        fit: 'contain',
        background: { ...bg, alpha: 1 },
      })
      .png()
      .toBuffer();

  return Promise.all([resizeToPng(imageA), resizeToPng(imageB)]);
}

function parseRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace(/^#/, '').padStart(6, '0').slice(0, 6);
  return {
    r: parseInt(normalized.slice(0, 2), 16) || 0,
    g: parseInt(normalized.slice(2, 4), 16) || 0,
    b: parseInt(normalized.slice(4, 6), 16) || 0,
  };
}
