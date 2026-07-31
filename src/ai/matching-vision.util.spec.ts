import {
  applyVisionToMatching,
  shouldRunVisionCompare,
} from './matching-vision.util';
import { parseImageCompareContent } from './providers/openai.vision.provider';

describe('matching-vision.util', () => {
  it('Vision 낮은 유사도면 텍스트 100점도 하향', () => {
    const result = applyVisionToMatching({
      scores: {
        brand: 100,
        model: 80,
        productName: 95,
        price: 40,
        option: 0,
        color: 50,
        image: 90,
        description: 30,
        ocr: 0,
      },
      matchingScore: 100,
      aiScore: 98,
      reason: '브랜드·상품명 일치',
      visionSimilarity: 12,
      visionReason: '검정 오피스체어 vs 빨간 흔들의자 — 형태 상이',
    });

    expect(result.scores.image).toBe(12);
    expect(result.matchingScore).toBeLessThanOrEqual(40);
    expect(result.aiScore).toBeLessThanOrEqual(40);
    expect(result.aiScore).toBeLessThan(50);
    expect(result.reason).toContain('Vision 이미지 12%');
  });

  it('Vision 높으면 점수를 유지·블렌드', () => {
    const result = applyVisionToMatching({
      scores: {
        brand: 90,
        model: 85,
        productName: 90,
        price: 70,
        option: 50,
        color: 80,
        image: 50,
        description: 40,
        ocr: 0,
      },
      matchingScore: 88,
      aiScore: 85,
      reason: '동일 모델 가능성',
      visionSimilarity: 92,
      visionReason: '동일 Aeron 형태',
    });

    expect(result.scores.image).toBe(92);
    expect(result.matchingScore).toBeGreaterThanOrEqual(70);
    expect(result.aiScore).toBeGreaterThanOrEqual(70);
  });

  it('shouldRunVisionCompare: 이미지 없고 저점이면 false', () => {
    expect(
      shouldRunVisionCompare({
        matchingScore: 20,
        scores: {
          brand: 10,
          model: 0,
          productName: 15,
          price: 0,
          option: 0,
          color: 0,
          image: 0,
          description: 0,
          ocr: 0,
        },
        rentalImageUrl: 'https://a.jpg',
        listingImageUrl: 'https://b.jpg',
      }),
    ).toBe(false);
  });

  it('shouldRunVisionCompare: 브랜드 고점이면 true', () => {
    expect(
      shouldRunVisionCompare({
        matchingScore: 30,
        scores: {
          brand: 90,
          model: 0,
          productName: 20,
          price: 0,
          option: 0,
          color: 0,
          image: 0,
          description: 0,
          ocr: 0,
        },
        rentalImageUrl: 'https://a.jpg',
        listingImageUrl: 'https://b.jpg',
      }),
    ).toBe(true);
  });
});

describe('parseImageCompareContent', () => {
  it('Vision JSON 파싱', () => {
    const parsed = parseImageCompareContent(
      JSON.stringify({
        imageSimilarity: 18,
        scores: {
          background: 40,
          composition: 20,
          color: 10,
          furnitureLayout: 5,
          texture: 15,
          logo: 0,
          damage: 0,
        },
        reason: '다른 의자',
      }),
    );
    expect(parsed.imageSimilarity).toBe(18);
    expect(parsed.scores.furnitureLayout).toBe(5);
    expect(parsed.reason).toBe('다른 의자');
  });
});
