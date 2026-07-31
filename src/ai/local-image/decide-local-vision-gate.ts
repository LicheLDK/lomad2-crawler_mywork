import type {
  LocalEngineScore,
  LocalLooksSameScore,
  LocalOpenCvScore,
  LocalPHashScore,
  MatchingLocalImageGateResult,
} from './local-image.types';

export interface LocalGateThresholds {
  colorRejectThreshold: number;
  pHashRejectThreshold: number;
  /** 이상이면 거의 동일 이미지 → Vision 스킵 + 고점수 */
  pHashPassThreshold: number;
  /** SSIM ≥ 이면 Vision 후보 (LooksSame 보완) */
  ssimThreshold: number;
  /** SSIM ≥ 이면 거의 동일 → Vision 스킵 + 고점수 */
  ssimPassThreshold: number;
  looksSameThreshold: number;
  openCvThreshold: number;
}

export function skippedLooksSame(threshold: number): LocalLooksSameScore {
  return {
    similarity: 0,
    equal: false,
    difference: 100,
    threshold,
    skipped: true,
    error: 'skipped by early gate',
  };
}

export function skippedOpenCv(): LocalOpenCvScore {
  return {
    similarity: 0,
    keyPointCount: 0,
    matchedFeatures: 0,
    skipped: true,
    error: 'skipped by early gate',
  };
}

export function skippedSsim(): LocalEngineScore {
  return {
    similarity: 0,
    skipped: true,
    error: 'skipped by early gate',
  };
}

/**
 * Color + pHash 조기 게이트.
 * - color 낮음 → Vision block
 * - pHash 낮음 → Vision block
 * - pHash 높음 → Vision skip (비용 절감, 고점수 로컬 반영)
 * - 그 외 → SSIM/LooksSame/OpenCV 로 continue
 */
export function decideEarlyLocalGate(input: {
  colorHist: LocalEngineScore;
  pHash: LocalPHashScore;
  thresholds: Pick<
    LocalGateThresholds,
    'colorRejectThreshold' | 'pHashRejectThreshold' | 'pHashPassThreshold'
  >;
}):
  | { action: 'block' | 'skip_vision_high'; result: MatchingLocalImageGateResult }
  | { action: 'continue' } {
  const { colorHist, pHash, thresholds } = input;
  const looksSame = skippedLooksSame(0);
  const openCv = skippedOpenCv();
  const ssim = skippedSsim();

  if (colorHist.skipped && pHash.skipped) {
    return { action: 'continue' };
  }

  if (
    !colorHist.skipped &&
    colorHist.similarity < thresholds.colorRejectThreshold
  ) {
    return {
      action: 'block',
      result: {
        colorHist,
        pHash,
        ssim,
        looksSame,
        openCv,
        shouldCallVision: false,
        localSimilarity: Math.round(colorHist.similarity),
        reason:
          `Color histogram ${colorHist.similarity}<${thresholds.colorRejectThreshold}` +
          ` — Vision blocked (색이 확연히 다름)`,
        stage: 'color',
      },
    };
  }

  if (!pHash.skipped && pHash.similarity < thresholds.pHashRejectThreshold) {
    const localSimilarity = Math.round(
      Math.min(
        pHash.similarity,
        colorHist.skipped ? pHash.similarity : colorHist.similarity,
      ),
    );
    return {
      action: 'block',
      result: {
        colorHist,
        pHash,
        ssim,
        looksSame,
        openCv,
        shouldCallVision: false,
        localSimilarity,
        reason:
          `pHash ${pHash.similarity}<${thresholds.pHashRejectThreshold}` +
          ` (hamming=${pHash.hammingDistance}) — Vision blocked`,
        stage: 'phash',
      },
    };
  }

  if (!pHash.skipped && pHash.similarity >= thresholds.pHashPassThreshold) {
    return {
      action: 'skip_vision_high',
      result: {
        colorHist,
        pHash,
        ssim,
        looksSame,
        openCv,
        shouldCallVision: false,
        localSimilarity: Math.round(pHash.similarity),
        reason:
          `pHash ${pHash.similarity}≥${thresholds.pHashPassThreshold}` +
          ` — near-duplicate, Vision skipped (cost save)`,
        stage: 'phash',
      },
    };
  }

  return { action: 'continue' };
}

/**
 * LooksSame + SSIM + OpenCV threshold 게이트 (Color/pHash 통과 후).
 * SSIM은 LooksSame 보완 — 구조적으로 비슷하면 Vision 후보.
 * SSIM이 매우 높으면 Vision 스킵(고점수).
 */
export function decideLocalVisionGate(input: {
  colorHist: LocalEngineScore;
  pHash: LocalPHashScore;
  ssim: LocalEngineScore;
  looksSame: LocalLooksSameScore;
  openCv: LocalOpenCvScore;
  looksSameThreshold: number;
  openCvThreshold: number;
  ssimThreshold: number;
  ssimPassThreshold: number;
}): MatchingLocalImageGateResult {
  const {
    colorHist,
    pHash,
    ssim,
    looksSame,
    openCv,
    looksSameThreshold,
    openCvThreshold,
    ssimThreshold,
    ssimPassThreshold,
  } = input;

  // SSIM 거의 동일 → Vision 스킵 (LooksSame보다 관대한 near-duplicate)
  if (!ssim.skipped && ssim.similarity >= ssimPassThreshold) {
    return {
      colorHist,
      pHash,
      ssim,
      looksSame,
      openCv,
      shouldCallVision: false,
      localSimilarity: Math.round(ssim.similarity),
      reason:
        `SSIM ${ssim.similarity}≥${ssimPassThreshold}` +
        ` — structurally near-duplicate, Vision skipped (cost save)`,
      stage: 'ssim',
    };
  }

  const allHeavySkipped =
    !!looksSame.skipped && !!openCv.skipped && !!ssim.skipped;
  const looksSamePassed =
    !looksSame.skipped && looksSame.similarity >= looksSameThreshold;
  const openCvPassed =
    !openCv.skipped && openCv.similarity >= openCvThreshold;
  const ssimPassed = !ssim.skipped && ssim.similarity >= ssimThreshold;

  const shouldCallVision =
    allHeavySkipped || looksSamePassed || openCvPassed || ssimPassed;

  const scores: number[] = [];
  if (!colorHist.skipped) scores.push(colorHist.similarity);
  if (!pHash.skipped) scores.push(pHash.similarity);
  if (!ssim.skipped) scores.push(ssim.similarity);
  if (!looksSame.skipped) scores.push(looksSame.similarity);
  if (!openCv.skipped) scores.push(openCv.similarity);
  const localSimilarity =
    scores.length > 0 ? Math.round(Math.max(...scores)) : 0;

  let reason: string;
  let stage: MatchingLocalImageGateResult['stage'] = 'looks_same_opencv';

  if (allHeavySkipped) {
    stage = 'engine_fallback';
    reason =
      `Local engines failed (LooksSame/SSIM/OpenCV) — Vision fallback` +
      (looksSame.error || ssim.error || openCv.error
        ? `: ${looksSame.error || ssim.error || openCv.error}`
        : '');
  } else if (shouldCallVision) {
    const parts: string[] = [];
    if (looksSamePassed) {
      parts.push(`LooksSame ${looksSame.similarity}≥${looksSameThreshold}`);
    }
    if (ssimPassed) {
      parts.push(`SSIM ${ssim.similarity}≥${ssimThreshold}`);
    }
    if (openCvPassed) {
      parts.push(`OpenCV ${openCv.similarity}≥${openCvThreshold}`);
    }
    reason = `Local gate passed (${parts.join(' OR ')}) — Vision eligible`;
  } else {
    reason =
      `Local gate blocked Vision (LooksSame ${looksSame.similarity}/${looksSameThreshold}` +
      `, SSIM ${ssim.skipped ? 'skip' : ssim.similarity}/${ssimThreshold}` +
      `, OpenCV ${openCv.similarity}/${openCvThreshold}` +
      `, color=${colorHist.skipped ? 'skip' : colorHist.similarity}` +
      `, pHash=${pHash.skipped ? 'skip' : pHash.similarity})`;
  }

  return {
    colorHist,
    pHash,
    ssim,
    looksSame,
    openCv,
    shouldCallVision,
    localSimilarity,
    reason,
    stage,
  };
}
