export interface LocalPreprocessOptions {
  maxWidth: number;
  maxHeight: number;
  backgroundHex?: string;
  normalize?: boolean;
}

/** 원본 Buffer는 변경하지 않고 비교용 PNG를 만든다. */
export async function preprocessForLocalCompare(
  source: Buffer,
  options: LocalPreprocessOptions,
): Promise<Buffer> {
  const sharp = require('sharp') as typeof import('sharp');
  const bg = parseRgb(options.backgroundHex ?? 'ffffff');
  const doNormalize = options.normalize !== false;

  let pipeline = sharp(Buffer.from(source), { failOn: 'error' })
    .rotate()
    .flatten({ background: bg })
    .resize(options.maxWidth, options.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });

  if (doNormalize) {
    pipeline = pipeline.normalize();
  }

  return pipeline.png().toBuffer();
}

function parseRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace(/^#/, '').padStart(6, '0').slice(0, 6);
  return {
    r: parseInt(normalized.slice(0, 2), 16) || 0,
    g: parseInt(normalized.slice(2, 4), 16) || 0,
    b: parseInt(normalized.slice(4, 6), 16) || 0,
  };
}
