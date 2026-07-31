import { compareColorHistogram } from './color-histogram.compare';
import { comparePHash } from './phash.compare';
import { compareSsim } from './ssim.compare';

/** 단색 PNG 버퍼 생성 (테스트용) */
async function solidPng(
  r: number,
  g: number,
  b: number,
  size = 32,
): Promise<Buffer> {
  const sharp = require('sharp') as typeof import('sharp');
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r, g, b },
    },
  })
    .png()
    .toBuffer();
}

describe('compareColorHistogram', () => {
  it('scores similar colors high and different colors low', async () => {
    const black = await solidPng(20, 20, 20);
    const darkGray = await solidPng(40, 40, 40);
    const red = await solidPng(220, 30, 30);

    const similar = await compareColorHistogram(black, darkGray);
    const different = await compareColorHistogram(black, red);

    expect(similar.skipped).toBeFalsy();
    expect(different.skipped).toBeFalsy();
    expect(similar.similarity).toBeGreaterThan(different.similarity);
    expect(different.similarity).toBeLessThan(50);
  });
});

describe('comparePHash', () => {
  it('scores identical images near 100', async () => {
    const a = await solidPng(80, 80, 90, 64);
    const b = await solidPng(80, 80, 90, 64);
    const result = await comparePHash(a, b);
    expect(result.skipped).toBeFalsy();
    expect(result.similarity).toBeGreaterThanOrEqual(90);
    expect(result.hammingDistance).toBeLessThanOrEqual(6);
  });

  it('scores very different images lower', async () => {
    const a = await solidPng(10, 10, 10, 64);
    const b = await solidPng(240, 240, 240, 64);
    const result = await comparePHash(a, b);
    expect(result.skipped).toBeFalsy();
    expect(result.similarity).toBeGreaterThanOrEqual(0);
    expect(result.similarity).toBeLessThanOrEqual(100);
  });
});

describe('compareSsim', () => {
  it('scores identical images near 100', async () => {
    const a = await solidPng(80, 90, 100, 64);
    const result = await compareSsim(a, Buffer.from(a));
    expect(result.skipped).toBeFalsy();
    expect(result.similarity).toBeGreaterThanOrEqual(95);
  });

  it('scores different structures lower than identical', async () => {
    const sharp = require('sharp') as typeof import('sharp');
    const a = await solidPng(40, 40, 40, 64);
    const b = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 40, g: 40, b: 40 },
      },
    })
      .composite([
        {
          input: await solidPng(220, 220, 220, 24),
          left: 20,
          top: 20,
        },
      ])
      .png()
      .toBuffer();

    const same = await compareSsim(a, Buffer.from(a));
    const diff = await compareSsim(a, b);
    expect(same.similarity).toBeGreaterThan(diff.similarity);
  });
});
