import { Logger } from '@nestjs/common';
import type { LocalEngineScore } from './local-image.types';

const logger = new Logger('SsimCompare');

/** SSIM 계산용 리사이즈 (전처리본보다 작아도 충분, 속도 우선) */
const SSIM_SIZE = 128;
const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;
const WINDOW = 8;

/**
 * Structural Similarity (SSIM) 0~100.
 * LooksSame보다 구조·조명 변화에 관대해 픽셀 엔진을 보완한다.
 */
export async function compareSsim(
  imageA: Buffer,
  imageB: Buffer,
): Promise<LocalEngineScore> {
  try {
    const [grayA, grayB] = await Promise.all([
      toGrayPlane(imageA),
      toGrayPlane(imageB),
    ]);

    if (grayA.width !== grayB.width || grayA.height !== grayB.height) {
      throw new Error('SSIM: gray planes must share dimensions');
    }

    const mssim = meanSsim(grayA.data, grayB.data, grayA.width, grayA.height);
    const similarity = Math.round(Math.max(0, Math.min(1, mssim)) * 1000) / 10;
    return { similarity };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`SSIM compare failed: ${message}`);
    return { similarity: 0, skipped: true, error: message };
  }
}

async function toGrayPlane(
  image: Buffer,
): Promise<{ data: Float64Array; width: number; height: number }> {
  const sharp = require('sharp') as typeof import('sharp');
  const { data, info } = await sharp(image, { failOn: 'error' })
    .greyscale()
    .resize(SSIM_SIZE, SSIM_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const plane = new Float64Array(info.width * info.height);
  for (let i = 0; i < plane.length; i++) {
    plane[i] = data[i];
  }
  return { data: plane, width: info.width, height: info.height };
}

/** 8×8 윈도우 평균 SSIM (Wang et al.) */
function meanSsim(
  a: Float64Array,
  b: Float64Array,
  width: number,
  height: number,
): number {
  const maxX = width - WINDOW;
  const maxY = height - WINDOW;
  if (maxX <= 0 || maxY <= 0) {
    return globalSsim(a, b);
  }

  let sum = 0;
  let count = 0;
  // stride 4 — 전수 슬라이딩보다 빠르고 충분
  const step = 4;
  for (let y = 0; y <= maxY; y += step) {
    for (let x = 0; x <= maxX; x += step) {
      sum += windowSsim(a, b, width, x, y);
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function windowSsim(
  a: Float64Array,
  b: Float64Array,
  width: number,
  ox: number,
  oy: number,
): number {
  const n = WINDOW * WINDOW;
  let sumA = 0;
  let sumB = 0;
  for (let wy = 0; wy < WINDOW; wy++) {
    const row = (oy + wy) * width + ox;
    for (let wx = 0; wx < WINDOW; wx++) {
      const i = row + wx;
      sumA += a[i];
      sumB += b[i];
    }
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let varA = 0;
  let varB = 0;
  let cov = 0;
  for (let wy = 0; wy < WINDOW; wy++) {
    const row = (oy + wy) * width + ox;
    for (let wx = 0; wx < WINDOW; wx++) {
      const i = row + wx;
      const da = a[i] - meanA;
      const db = b[i] - meanB;
      varA += da * da;
      varB += db * db;
      cov += da * db;
    }
  }
  varA /= n - 1;
  varB /= n - 1;
  cov /= n - 1;

  const numerator = (2 * meanA * meanB + C1) * (2 * cov + C2);
  const denominator =
    (meanA * meanA + meanB * meanB + C1) * (varA + varB + C2);
  return denominator > 0 ? numerator / denominator : 0;
}

function globalSsim(a: Float64Array, b: Float64Array): number {
  const n = a.length;
  if (n === 0) return 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let varA = 0;
  let varB = 0;
  let cov = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    varA += da * da;
    varB += db * db;
    cov += da * db;
  }
  varA /= n - 1;
  varB /= n - 1;
  cov /= n - 1;
  const numerator = (2 * meanA * meanB + C1) * (2 * cov + C2);
  const denominator =
    (meanA * meanA + meanB * meanB + C1) * (varA + varB + C2);
  return denominator > 0 ? numerator / denominator : 0;
}
