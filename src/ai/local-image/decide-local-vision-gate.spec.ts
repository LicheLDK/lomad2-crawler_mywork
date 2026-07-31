import {
  decideEarlyLocalGate,
  decideLocalVisionGate,
} from './decide-local-vision-gate';

describe('decideEarlyLocalGate', () => {
  const thresholds = {
    colorRejectThreshold: 35,
    pHashRejectThreshold: 30,
    pHashPassThreshold: 90,
  };

  it('blocks Vision when color histogram is low', () => {
    const early = decideEarlyLocalGate({
      colorHist: { similarity: 20 },
      pHash: { similarity: 70, hammingDistance: 19 },
      thresholds,
    });
    expect(early.action).toBe('block');
    if (early.action === 'block') {
      expect(early.result.stage).toBe('color');
      expect(early.result.ssim.skipped).toBe(true);
      expect(early.result.shouldCallVision).toBe(false);
    }
  });

  it('blocks Vision when pHash is low', () => {
    const early = decideEarlyLocalGate({
      colorHist: { similarity: 80 },
      pHash: { similarity: 15, hammingDistance: 54 },
      thresholds,
    });
    expect(early.action).toBe('block');
    if (early.action === 'block') {
      expect(early.result.stage).toBe('phash');
    }
  });

  it('skips Vision with high score when pHash near-duplicate', () => {
    const early = decideEarlyLocalGate({
      colorHist: { similarity: 75 },
      pHash: { similarity: 95, hammingDistance: 3 },
      thresholds,
    });
    expect(early.action).toBe('skip_vision_high');
    if (early.action === 'skip_vision_high') {
      expect(early.result.localSimilarity).toBe(95);
    }
  });

  it('continues to LooksSame/SSIM/OpenCV when mid-range', () => {
    const early = decideEarlyLocalGate({
      colorHist: { similarity: 60 },
      pHash: { similarity: 55, hammingDistance: 29 },
      thresholds,
    });
    expect(early.action).toBe('continue');
  });
});

describe('decideLocalVisionGate', () => {
  const colorHist = { similarity: 60 };
  const pHash = { similarity: 55, hammingDistance: 29 };
  const baseLooksSame = {
    similarity: 10,
    equal: false,
    difference: 90,
    threshold: 70,
  };
  const baseOpenCv = {
    similarity: 20,
    keyPointCount: 100,
    matchedFeatures: 5,
  };
  const baseSsim = { similarity: 40 };

  it('blocks Vision when LooksSame/SSIM/OpenCV all below threshold', () => {
    const gate = decideLocalVisionGate({
      colorHist,
      pHash,
      ssim: baseSsim,
      looksSame: baseLooksSame,
      openCv: baseOpenCv,
      looksSameThreshold: 70,
      openCvThreshold: 60,
      ssimThreshold: 75,
      ssimPassThreshold: 92,
    });
    expect(gate.shouldCallVision).toBe(false);
    expect(gate.localSimilarity).toBe(60);
    expect(gate.stage).toBe('looks_same_opencv');
  });

  it('allows Vision when SSIM passes (LooksSame complement)', () => {
    const gate = decideLocalVisionGate({
      colorHist,
      pHash,
      ssim: { similarity: 78 },
      looksSame: baseLooksSame,
      openCv: baseOpenCv,
      looksSameThreshold: 70,
      openCvThreshold: 60,
      ssimThreshold: 75,
      ssimPassThreshold: 92,
    });
    expect(gate.shouldCallVision).toBe(true);
    expect(gate.reason).toContain('SSIM');
    expect(gate.localSimilarity).toBe(78);
  });

  it('skips Vision when SSIM near-duplicate', () => {
    const gate = decideLocalVisionGate({
      colorHist,
      pHash,
      ssim: { similarity: 94 },
      looksSame: baseLooksSame,
      openCv: baseOpenCv,
      looksSameThreshold: 70,
      openCvThreshold: 60,
      ssimThreshold: 75,
      ssimPassThreshold: 92,
    });
    expect(gate.shouldCallVision).toBe(false);
    expect(gate.stage).toBe('ssim');
    expect(gate.localSimilarity).toBe(94);
  });

  it('allows Vision when OpenCV passes', () => {
    const gate = decideLocalVisionGate({
      colorHist,
      pHash,
      ssim: baseSsim,
      looksSame: baseLooksSame,
      openCv: { ...baseOpenCv, similarity: 65 },
      looksSameThreshold: 70,
      openCvThreshold: 60,
      ssimThreshold: 75,
      ssimPassThreshold: 92,
    });
    expect(gate.shouldCallVision).toBe(true);
  });

  it('falls back to Vision when all heavy engines skipped', () => {
    const gate = decideLocalVisionGate({
      colorHist,
      pHash,
      ssim: { similarity: 0, skipped: true, error: 'boom' },
      looksSame: { ...baseLooksSame, skipped: true, error: 'boom' },
      openCv: { ...baseOpenCv, skipped: true, error: 'boom' },
      looksSameThreshold: 70,
      openCvThreshold: 60,
      ssimThreshold: 75,
      ssimPassThreshold: 92,
    });
    expect(gate.shouldCallVision).toBe(true);
    expect(gate.stage).toBe('engine_fallback');
  });
});
