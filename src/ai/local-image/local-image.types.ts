/** LooksSame / OpenCV / Color / pHash / SSIM 단일 엔진 결과 (매칭 게이트용) */
export interface LocalEngineScore {
  similarity: number;
  skipped?: boolean;
  error?: string;
}

export interface LocalLooksSameScore extends LocalEngineScore {
  equal: boolean;
  difference: number;
  threshold: number;
}

export interface LocalOpenCvScore extends LocalEngineScore {
  keyPointCount: number;
  matchedFeatures: number;
}

export interface LocalPHashScore extends LocalEngineScore {
  hammingDistance: number;
}

/**
 * Matching 파이프라인용 로컬 이미지 게이트 결과.
 * shouldCallVision=false 이면 ChatGPT Vision 호출을 생략한다.
 *
 * 파이프라인: Color → pHash → LooksSame + SSIM + OpenCV → Vision
 */
export interface MatchingLocalImageGateResult {
  colorHist: LocalEngineScore;
  pHash: LocalPHashScore;
  ssim: LocalEngineScore;
  looksSame: LocalLooksSameScore;
  openCv: LocalOpenCvScore;
  /** Vision 호출 여부 */
  shouldCallVision: boolean;
  /** Vision 스킵 시 Matching image 점수에 주입할 로컬 유사도 (0~100) */
  localSimilarity: number;
  reason: string;
  /** 어느 단계에서 결정했는지 */
  stage:
    | 'color'
    | 'phash'
    | 'ssim'
    | 'looks_same_opencv'
    | 'engine_fallback';
}
