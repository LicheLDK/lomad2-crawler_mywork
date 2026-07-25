import type { AiReportInput } from '../../ai.types';
import type { PromptVars } from '../prompt.types';

export function buildReportPromptVars(input: AiReportInput): PromptVars {
  return {
    payload: {
      orderNo: input.orderNo ?? null,
      investigationCaseNo: input.investigationCaseNo ?? null,
      siteCode: input.siteCode ?? null,
      productName: input.productName ?? input.rental?.productName ?? null,
      listingTitle: input.listingTitle ?? input.listing?.title ?? null,
      summary: input.summary ?? null,
      aiScore: input.aiScore ?? null,
      matchingScore: input.matchingScore ?? null,
      findings: input.findings ?? [],
      evidence: input.evidence ?? [],
      timeline: input.timeline ?? [],
      recommendation: input.recommendation ?? null,
      humanFinalDecision:
        input.humanFinalDecision ?? input.finalDecision ?? null,
      humanFinalDecisionRationale:
        input.humanFinalDecisionRationale ??
        input.finalDecisionRationale ??
        null,
      rental: input.rental
        ? {
            brand: input.rental.brand ?? null,
            productName: input.rental.productName ?? null,
            modelName: input.rental.modelName ?? null,
            price: input.rental.price ?? null,
          }
        : null,
      listing: input.listing
        ? {
            title: input.listing.title ?? null,
            price: input.listing.price ?? null,
            siteCode: input.listing.siteCode ?? null,
            url: input.listing.url ?? null,
          }
        : null,
    },
  };
}
