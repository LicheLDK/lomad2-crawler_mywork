import { applyLocalToMatching } from './apply-local-to-matching';

describe('applyLocalToMatching', () => {
  const baseScores = {
    brand: 90,
    model: 80,
    productName: 85,
    price: 70,
    option: 60,
    color: 50,
    image: 80,
    description: 40,
    ocr: 30,
  };

  it('low local similarity pulls down high matching score', () => {
    const result = applyLocalToMatching({
      scores: baseScores,
      matchingScore: 95,
      aiScore: 92,
      reason: '텍스트 매칭 높음',
      localSimilarity: 12,
      localReason: 'Local gate blocked Vision',
    });

    expect(result.matchingScore).toBeLessThanOrEqual(40);
    expect(result.scores.image).toBe(12);
    expect(result.reason).toContain('Local 이미지(Color/pHash/SSIM/LooksSame/OpenCV)');
    expect(result.reason).not.toContain('Vision 이미지');
  });

  it('high local similarity keeps blended score', () => {
    const result = applyLocalToMatching({
      scores: baseScores,
      matchingScore: 80,
      aiScore: 78,
      reason: 'ok',
      localSimilarity: 88,
      localReason: 'Local gate passed',
    });

    expect(result.scores.image).toBe(88);
    expect(result.matchingScore).toBeGreaterThan(50);
  });
});
