import type { AiInvestigationInput } from '../../ai.types';
import type { PromptVars } from '../prompt.types';

export function buildInvestigationPromptVars(
  input: AiInvestigationInput,
): PromptVars {
  return {
    payload: {
      rental: {
        brand: input.rental?.brand ?? null,
        productName: input.rental?.productName ?? null,
        modelName: input.rental?.modelName ?? null,
        option: input.rental?.option ?? null,
        color: input.rental?.color ?? null,
        price: input.rental?.price ?? null,
        imageUrl: input.rental?.imageUrl ?? null,
        description: truncate(input.rental?.description, 600),
        ocrText: truncate(input.rental?.ocrText, 400),
      },
      listing: {
        title: input.listing.title,
        brand: input.listing.brand ?? null,
        modelName: input.listing.modelName ?? null,
        option: input.listing.option ?? null,
        color: input.listing.color ?? null,
        price: input.listing.price ?? null,
        imageUrl: input.listing.imageUrl ?? null,
        description: truncate(input.listing.description, 800),
        ocrText: truncate(input.listing.ocrText ?? input.ocrText, 400),
        siteCode: input.listing.siteCode ?? input.siteCode ?? null,
        url: input.listing.url ?? null,
      },
      matching: input.matching
        ? {
            matchingScore: input.matching.matchingScore,
            aiScore: input.matching.aiScore,
            reason: input.matching.reason,
            scores: input.matching.scores,
          }
        : null,
      image: {
        rentalImageUrl: input.rental?.imageUrl ?? input.imageUrl ?? null,
        listingImageUrl: input.listing.imageUrl ?? null,
      },
      ocr: {
        rental: truncate(input.rental?.ocrText, 400),
        listing: truncate(input.listing.ocrText ?? input.ocrText, 400),
      },
      orderNo: input.orderNo ?? null,
    },
  };
}

function truncate(
  value: string | null | undefined,
  max: number,
): string | null {
  if (!value) return null;
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
