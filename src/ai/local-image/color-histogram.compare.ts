import { Logger } from '@nestjs/common';
import type { LocalEngineScore } from './local-image.types';

const logger = new Logger('ColorHistogramCompare');

const BINS = 16;
const SAMPLE_SIZE = 64;

/**
 * 색 유사도 (0~100).
 * - mean RGB 거리 (단색·배경 차이에 안정적)
 * - RGB 히스토그램 intersection (분포)
 * 둘을 블렌드해 Vision 전 “확연히 다른 색”을 걸러낸다.
 */
export async function compareColorHistogram(
  imageA: Buffer,
  imageB: Buffer,
): Promise<LocalEngineScore> {
  try {
    const [featA, featB] = await Promise.all([
      extractColorFeatures(imageA),
      extractColorFeatures(imageB),
    ]);

    const meanSim = meanColorSimilarity(featA.mean, featB.mean);
    const histSim = histogramIntersection(featA.hist, featB.hist) * 100;
    // mean 비중을 높여 단색/제품 주색 차이에 민감하게
    const similarity =
      Math.round((meanSim * 0.65 + histSim * 0.35) * 10) / 10;

    return { similarity: clamp(similarity) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Color histogram compare failed: ${message}`);
    return { similarity: 0, skipped: true, error: message };
  }
}

type ColorFeatures = {
  mean: [number, number, number];
  hist: Float64Array;
};

async function extractColorFeatures(image: Buffer): Promise<ColorFeatures> {
  const sharp = require('sharp') as typeof import('sharp');
  const { data, info } = await sharp(image, { failOn: 'error' })
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  if (channels < 3) {
    throw new Error(`Color compare expects RGB, got channels=${channels}`);
  }

  const hist = new Float64Array(BINS * 3);
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  const pixelCount = info.width * info.height;

  for (let i = 0; i < pixelCount; i++) {
    const o = i * channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    // soft bin: 주 bin + 인접 bin에 일부 가중
    accumulateSoft(hist, 0, r);
    accumulateSoft(hist, BINS, g);
    accumulateSoft(hist, BINS * 2, b);
  }

  for (let c = 0; c < 3; c++) {
    let sum = 0;
    for (let b = 0; b < BINS; b++) sum += hist[c * BINS + b];
    if (sum <= 0) continue;
    for (let b = 0; b < BINS; b++) hist[c * BINS + b] /= sum;
  }

  return {
    mean: [sumR / pixelCount, sumG / pixelCount, sumB / pixelCount],
    hist,
  };
}

function accumulateSoft(hist: Float64Array, offset: number, value: number) {
  const pos = (value / 255) * (BINS - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(BINS - 1, lo + 1);
  const t = pos - lo;
  hist[offset + lo] += 1 - t;
  hist[offset + hi] += t;
}

function meanColorSimilarity(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dist = Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
  const maxDist = Math.sqrt(3 * 255 * 255);
  return (1 - dist / maxDist) * 100;
}

function histogramIntersection(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.min(a[i], b[i]);
  }
  return Math.max(0, Math.min(1, sum / 3));
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
