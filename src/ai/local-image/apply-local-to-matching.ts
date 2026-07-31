import type { AiMatchingItemScores } from '../ai.types';
import { applyVisionToMatching } from '../matching-vision.util';

/**
 * 로컬 LooksSame/OpenCV 유사도를 Matching 점수에 반영.
 * Vision 과 동일 보정 로직을 쓰되 reason 라벨만 Local 로 표시한다.
 */
export function applyLocalToMatching(input: {
  scores: AiMatchingItemScores;
  matchingScore: number;
  aiScore: number;
  reason: string;
  localSimilarity: number;
  localReason: string;
}): {
  scores: AiMatchingItemScores;
  matchingScore: number;
  aiScore: number;
  reason: string;
} {
  const adjusted = applyVisionToMatching({
    scores: input.scores,
    matchingScore: input.matchingScore,
    aiScore: input.aiScore,
    reason: input.reason,
    visionSimilarity: input.localSimilarity,
    visionReason: input.localReason,
  });

  // applyVisionToMatching 이 "Vision 이미지" 문구를 붙이므로 Local 로 치환
  const reason = adjusted.reason.replace(
    /Vision 이미지/g,
    'Local 이미지(Color/pHash/SSIM/LooksSame/OpenCV)',
  );

  return { ...adjusted, reason };
}
