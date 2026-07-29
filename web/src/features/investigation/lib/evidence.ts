import type { EvidenceKind } from '../types';

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  original_url: '원본 URL',
  screenshot: '스크린샷',
  product_image: '상품 이미지',
  ocr: 'OCR',
  html_snapshot: 'HTML Snapshot',
};
