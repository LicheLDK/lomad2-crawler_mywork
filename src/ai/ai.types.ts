/**
 * AI Engine — 공통 타입.
 * UI / Controller 는 이 타입만 알고, Provider 구현체는 보지 않는다.
 */

export type AiProviderName = 'openai' | 'anthropic' | 'gemini';

/** AI Engine 이 수행하는 작업 종류 (Pipeline 단계) */
export type AiTaskKind =
  | 'keyword'
  | 'matching'
  | 'investigation'
  | 'recommendation'
  | 'image'
  | 'ocr'
  | 'report';

export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiCompletionRequest {
  task: AiTaskKind;
  messages: AiMessage[];
  /** Provider 별 모델 오버라이드 (없으면 config 기본값) */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** 디버그/추적 */
  metadata?: Record<string, unknown>;
}

export interface AiCompletionResponse {
  provider: AiProviderName;
  model: string;
  content: string;
  raw?: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/** 도메인 입력 — Keyword 생성 */
export interface AiKeywordInput {
  brand?: string | null;
  productName?: string | null;
  modelName?: string | null;
  option?: string | null;
  color?: string | null;
}

export interface AiKeywordResult {
  keywords: string[];
  raw?: string;
}

/** 도메인 입력 — 렌탈 상품 (Matching) */
export interface AiRentalProduct {
  brand?: string | null;
  productName?: string | null;
  modelName?: string | null;
  option?: string | null;
  color?: string | null;
  price?: string | number | null;
  imageUrl?: string | null;
  description?: string | null;
  ocrText?: string | null;
}

/** 도메인 입력 — 크롤 검색 결과 (Matching) */
export interface AiListingCandidate {
  id?: string;
  title: string;
  price?: string | number | null;
  brand?: string | null;
  modelName?: string | null;
  option?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  ocrText?: string | null;
  siteCode?: string | null;
  url?: string | null;
  /** 기존 heuristic (0~1) — 참고용 */
  titleSimilarity?: number | null;
  imageSimilarity?: number | null;
}

/** @deprecated use AiMatchingInput with rental + listing */
export interface AiMatchingInput {
  rental: AiRentalProduct;
  listing: AiListingCandidate;
}

/** 항목별 Matching Score (0~100) */
export interface AiMatchingItemScores {
  brand: number;
  model: number;
  productName: number;
  price: number;
  option: number;
  color: number;
  image: number;
  description: number;
  ocr: number;
}

export interface AiMatchingResult {
  /** 종합 Matching Score 0~100 */
  matchingScore: number;
  /** 최종 AI Score 0~100 */
  aiScore: number;
  /** 판단 근거 */
  reason: string;
  /** 항목별 0~100 */
  scores: AiMatchingItemScores;
  raw?: string;
  listingId?: string;
}


/** 도메인 입력 — Investigation 분석 */
export interface AiInvestigationInput {
  orderNo?: string | null;
  rental?: AiRentalProduct | null;
  listing: AiListingCandidate;
  matching?: Pick<
    AiMatchingResult,
    'matchingScore' | 'aiScore' | 'reason' | 'scores'
  > | null;
  /** 편의를 위한 flat 필드 (listing/rental과 중복 가능) */
  productName?: string | null;
  listingTitle?: string | null;
  siteCode?: string | null;
  imageUrl?: string | null;
  ocrText?: string | null;
  titleSimilarity?: number | null;
  imageSimilarity?: number | null;
}

export interface AiInvestigationResult {
  /** Investigation Summary (plain text) — Recommendation 과 분리 */
  summary: string;
  /** 판단 근거 목록 (plain text) */
  reasons: string[];
  riskLevel: 'high' | 'medium' | 'low';
  raw?: string;
}

/** AI Recommendation — Summary 와 분리된 추천 패널용 */
export interface AiRecommendationResult {
  /** 1~5 */
  stars: number;
  /** 예: 재판매 가능성이 매우 높습니다. */
  headline: string;
  /** 예: 증거 저장, 담당자 지정, 추가 조사 */
  actions: string[];
  /** 추천 이유 (plain text) */
  reasons: string[];
  raw?: string;
}

/** 도메인 입력 — Report */
export type AiReportFinalDecisionCode =
  | 'resale_confirmed'
  | 'further_investigation'
  | 'false_positive'
  | 'excluded'
  | 'pending';

export interface AiReportEvidenceItem {
  title: string;
  detail?: string | null;
  url?: string | null;
  kind?: string | null;
}

export interface AiReportTimelineItem {
  at: string;
  title: string;
  detail?: string | null;
  kind?: string | null;
}

export interface AiReportRecommendationBlock {
  stars?: number | null;
  headline?: string | null;
  actions?: string[];
  reasons?: string[];
}

export interface AiReportInput {
  orderNo?: string | null;
  investigationCaseNo?: string | null;
  siteCode?: string | null;
  listingTitle?: string | null;
  productName?: string | null;
  /** 기존 findings / notes */
  findings?: string[];
  summary?: string | null;
  aiScore?: number | null;
  matchingScore?: number | null;
  evidence?: AiReportEvidenceItem[];
  timeline?: AiReportTimelineItem[];
  recommendation?: AiReportRecommendationBlock | null;
  /**
   * 사람이 이미 확정한 Final Decision (입력).
   * AI 가 이 값을 대체하지 않는다 — Report 에 표시만.
   */
  humanFinalDecision?: AiReportFinalDecisionCode | string | null;
  humanFinalDecisionRationale?: string | null;
  /**
   * @deprecated use humanFinalDecision — 호환용
   */
  finalDecision?: AiReportFinalDecisionCode | string | null;
  /** @deprecated use humanFinalDecisionRationale */
  finalDecisionRationale?: string | null;
  rental?: AiRentalProduct | null;
  listing?: AiListingCandidate | null;
}

/** Report JSON Document — PDF/HTML 공통 소스 */
export interface AiReportDocument {
  title: string;
  generatedAt: string;
  meta: {
    orderNo: string | null;
    investigationCaseNo: string | null;
    siteCode: string | null;
    productName: string | null;
    listingTitle: string | null;
  };
  summary: string;
  aiScore: number;
  matchingScore: number | null;
  evidence: AiReportEvidenceItem[];
  timeline: AiReportTimelineItem[];
  recommendation: {
    stars: number | null;
    headline: string;
    actions: string[];
    reasons: string[];
  };
  /**
   * AI 제안 판정 — 사람의 Final Decision 이 아님 (Principle 6)
   */
  suggestedDecision: {
    code: AiReportFinalDecisionCode | string;
    label: string;
    rationale: string;
  };
  /** 사람 확정 판정 (있으면 Report Final Decision 섹션에 표시) */
  humanFinalDecision: {
    code: AiReportFinalDecisionCode | string;
    label: string;
    rationale: string;
  } | null;
}

export interface AiReportResult {
  /** Structured JSON (PDF 파이프라인 입력) */
  json: AiReportDocument;
  /** PDF-ready HTML (print/@page 포함) */
  html: string;
  title: string;
  summary: string;
  aiScore: number;
  raw?: string;
}

/** Vision — 이미지 비교 항목 점수 (0~100) */
export interface AiImageItemScores {
  /** 배경 */
  background: number;
  /** 구도 */
  composition: number;
  /** 색상 */
  color: number;
  /** 가구 배치 */
  furnitureLayout: number;
  /** 텍스처 */
  texture: number;
  /** 로고 */
  logo: number;
  /** 손상 여부 (높을수록 손상 패턴이 유사 / 또는 동일 개체 가능성) */
  damage: number;
}

export interface AiImageCompareRequest {
  rentalImageUrl: string;
  listingImageUrl: string;
  productHint?: string | null;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface AiImageCompareResponse {
  provider: AiProviderName;
  /** 최종 Image Similarity 0~100 */
  imageSimilarity: number;
  scores: AiImageItemScores;
  reason: string;
  model?: string;
  raw?: unknown;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/** OCR Analysis — 원문 OCR → 정규화·필드 추출 */
export interface AiOcrInput {
  /** 원시 OCR 텍스트 */
  rawText: string;
  /** 참고용 (사이트·키워드 등) */
  siteCode?: string | null;
  listingTitle?: string | null;
  imageUrl?: string | null;
}

export interface AiOcrFields {
  /** 정규화된 상품명 예: 뷰티레스트 King */
  productName: string | null;
  price: string | null;
  region: string | null;
  seller: string | null;
  contact: string | null;
  description: string | null;
}

export interface AiOcrResult {
  /** 정규화된 전체 텍스트 (선택) */
  normalizedText: string;
  fields: AiOcrFields;
  /** 정규화 예시 로그용 */
  normalizations: Array<{ from: string; to: string }>;
  raw?: string;
}

export class AiEngineError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'NOT_IMPLEMENTED'
      | 'PROVIDER_UNAVAILABLE'
      | 'INVALID_REQUEST'
      | 'PROVIDER_ERROR'
      | 'RATE_LIMITED'
      | 'CONTENT_FILTER'
      | 'TOKEN_LIMIT' = 'PROVIDER_ERROR',
  ) {
    super(message);
    this.name = 'AiEngineError';
  }
}
