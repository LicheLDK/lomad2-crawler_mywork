/**
 * 간단한 aHash(Average Hash) 기반 이미지 해시.
 * sharp는 호출 시점에 lazy require (네이티브 바이너리 문제로 부팅 전체가 죽지 않게).
 */
export async function computeAverageHash(
  buffer: Buffer,
  size = 8,
): Promise<string> {
   
  const sharp = require('sharp') as typeof import('sharp');

  const raw = await sharp(buffer)
    .greyscale()
    .resize(size, size, { fit: 'fill' })
    .raw()
    .toBuffer();

  const avg =
    raw.reduce((sum, value) => sum + value, 0) / Math.max(raw.length, 1);

  let hash = '';
  for (const value of raw) {
    hash += value >= avg ? '1' : '0';
  }

  return BigInt(`0b${hash}`).toString(16).padStart(16, '0');
}

/** Hamming distance between two hex hashes */
export function hammingDistance(a: string, b: string): number {
  const left = BigInt(`0x${a}`);
  const right = BigInt(`0x${b}`);
  let xor = left ^ right;
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

export function imageSimilarityFromHashes(a: string, b: string): number {
  const bits = Math.max(a.length, b.length) * 4;
  const distance = hammingDistance(a, b);
  return Math.max(0, 1 - distance / bits);
}
