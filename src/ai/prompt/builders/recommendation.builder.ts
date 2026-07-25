import type {
  AiListingCandidate,
  AiMatchingItemScores,
  AiRentalProduct,
} from '../../ai.types';
import type { PromptVars } from '../prompt.types';

export type AiRecommendationPromptInput = {
  orderNo?: string | null;
  rental?: AiRentalProduct | null;
  listing: AiListingCandidate;
  matching?: {
    matchingScore: number;
    aiScore: number;
    reason: string;
    scores: AiMatchingItemScores;
  } | null;
  investigationSummary?: string | null;
  judgmentReasons?: string[] | null;
};

export function buildRecommendationPromptVars(
  input: AiRecommendationPromptInput,
): PromptVars {
  return {
    payload: {
      orderNo: input.orderNo ?? null,
      rental: input.rental ?? null,
      listing: {
        title: input.listing.title,
        price: input.listing.price ?? null,
        siteCode: input.listing.siteCode ?? null,
        imageUrl: input.listing.imageUrl ?? null,
      },
      matching: input.matching ?? null,
      investigationSummaryRef: input.investigationSummary ?? null,
      judgmentReasonsRef: input.judgmentReasons ?? null,
    },
  };
}
