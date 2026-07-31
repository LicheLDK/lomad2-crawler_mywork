import { Logger } from '@nestjs/common';
import type { LocalPHashScore } from './local-image.types';

const logger = new Logger('PHashCompare');

const DCT_SIZE = 32;
const HASH_SIZE = 8;
const HASH_BITS = HASH_SIZE * HASH_SIZE; // 64

/**
 * DCT 기반 pHash 유사도 (0~100).
 * Hamming distance → similarity = (64 - distance) / 64 * 100
 */
export async function comparePHash(
  imageA: Buffer,
  imageB: Buffer,
): Promise<LocalPHashScore> {
  try {
    const [hashA, hashB] = await Promise.all([
      computePHashBits(imageA),
      computePHashBits(imageB),
    ]);
    const distance = hammingDistance(hashA, hashB);
    const similarity =
      Math.round(((HASH_BITS - distance) / HASH_BITS) * 1000) / 10;
    return { similarity, hammingDistance: distance };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`pHash compare failed: ${message}`);
    return {
      similarity: 0,
      hammingDistance: HASH_BITS,
      skipped: true,
      error: message,
    };
  }
}

async function computePHashBits(image: Buffer): Promise<Uint8Array> {
  const sharp = require('sharp') as typeof import('sharp');
  const { data } = await sharp(image, { failOn: 'error' })
    .greyscale()
    .resize(DCT_SIZE, DCT_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Float64Array(DCT_SIZE * DCT_SIZE);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = data[i];
  }

  const dct = dct2D(pixels, DCT_SIZE);
  // 좌상단 HASH_SIZE×HASH_SIZE (DC 제외한 저주파) — DC 포함 median이 흔히 쓰이므로
  // DC(0,0) 제외 후 median 기준으로 비트 생성
  const coeffs: number[] = [];
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (x === 0 && y === 0) continue;
      coeffs.push(dct[y * DCT_SIZE + x]);
    }
  }
  const median = medianOf(coeffs);

  const bits = new Uint8Array(HASH_BITS);
  let bit = 0;
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (x === 0 && y === 0) {
        bits[bit++] = 0;
        continue;
      }
      bits[bit++] = dct[y * DCT_SIZE + x] > median ? 1 : 0;
    }
  }
  return bits;
}

function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) d += 1;
  }
  return d;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** Separable 2D DCT-II (orthonormal-ish scale not required for median hash) */
function dct2D(pixels: Float64Array, n: number): Float64Array {
  const temp = new Float64Array(n * n);
  const out = new Float64Array(n * n);
  const cos = buildCosTable(n);

  // rows
  for (let y = 0; y < n; y++) {
    for (let u = 0; u < n; u++) {
      let sum = 0;
      for (let x = 0; x < n; x++) {
        sum += pixels[y * n + x] * cos[u * n + x];
      }
      temp[y * n + u] = sum;
    }
  }
  // cols
  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      let sum = 0;
      for (let y = 0; y < n; y++) {
        sum += temp[y * n + u] * cos[v * n + y];
      }
      out[v * n + u] = sum;
    }
  }
  return out;
}

function buildCosTable(n: number): Float64Array {
  const table = new Float64Array(n * n);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      table[k * n + i] = Math.cos(((2 * i + 1) * k * Math.PI) / (2 * n));
    }
  }
  return table;
}
