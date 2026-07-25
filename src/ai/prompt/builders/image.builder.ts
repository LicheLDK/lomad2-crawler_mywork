import type { AiImageCompareRequest } from '../../ai.types';
import type { PromptVars } from '../prompt.types';

export function buildImagePromptVars(input: {
  rentalImageUrl: string;
  listingImageUrl: string;
  productHint?: string | null;
}): PromptVars {
  const hint = input.productHint?.trim();
  return {
    rentalImageUrl: input.rentalImageUrl,
    listingImageUrl: input.listingImageUrl,
    productHintLine: hint ? `상품 힌트: ${hint}` : '',
  };
}

export function describeImageCompareInput(
  request: AiImageCompareRequest,
): string {
  return JSON.stringify(
    {
      rentalImageUrl: request.rentalImageUrl,
      listingImageUrl: request.listingImageUrl,
      productHint: request.productHint ?? null,
    },
    null,
    2,
  );
}
