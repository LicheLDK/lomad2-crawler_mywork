import type {
  AiListingCandidate,
  AiOcrResult,
  AiRentalProduct,
} from '../../ai.types';
import type { PromptVars } from '../prompt.types';

export function buildMatchingPromptVars(input: {
  rental: AiRentalProduct;
  listing: AiListingCandidate;
  ocrAnalysis?: AiOcrResult | null;
}): PromptVars {
  const payload: Record<string, unknown> = {
    rental: {
      brand: input.rental.brand ?? null,
      productName: input.rental.productName ?? null,
      modelName: input.rental.modelName ?? null,
      option: input.rental.option ?? null,
      color: input.rental.color ?? null,
      price: input.rental.price ?? null,
      imageUrl: input.rental.imageUrl ?? null,
      description: input.rental.description ?? null,
      ocrText: input.rental.ocrText ?? null,
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
      ocrText: truncate(input.listing.ocrText, 400),
      siteCode: input.listing.siteCode ?? null,
      heuristicTitleSimilarity: input.listing.titleSimilarity ?? null,
      heuristicImageSimilarity: input.listing.imageSimilarity ?? null,
    },
  };

  if (input.ocrAnalysis) {
    const f = input.ocrAnalysis.fields;
    payload.ocrAnalysis = {
      normalizedText: input.ocrAnalysis.normalizedText || null,
      brand: f.productName?.split(' ')[0] ?? null,
      model: f.productName ?? null,
      price: f.price ?? null,
      seller: f.seller ?? null,
      description: f.description ?? null,
    };
  }

  return { payload };
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
