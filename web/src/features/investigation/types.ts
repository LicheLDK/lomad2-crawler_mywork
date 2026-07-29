export type InvestigationStatus =
  | 'Open'
  | 'Investigating'
  | 'Review'
  | 'Completed'
  | 'Archived';

export type InvestigationPriority = 'High' | 'Medium' | 'Low';

/** 0~1 점수. AI Analysis Panel Progress Bar용 */
export type InvestigationAiAnalysis = {
  imageSimilarity: number;
  titleSimilarity: number;
  brandMatch: number;
  modelMatch: number;
  priceSimilarity: number;
  ocrMatch: number;
};

export type EvidenceKind =
  | 'original_url'
  | 'screenshot'
  | 'product_image'
  | 'ocr'
  | 'html_snapshot';

export type InvestigationEvidence = {
  id: string;
  kind: EvidenceKind;
  /** 표시 라벨 (원본 URL, 스크린샷 …) */
  label: string;
  /** URL 또는 OCR/HTML 텍스트 */
  value?: string | null;
  savedAt: string;
};

export type TimelineEventKind =
  | 'search_run'
  | 'ai_analysis'
  | 'investigation_created'
  | 'ai_rule_warning'
  | 'order_mapped'
  | 'investigation_summary'
  | 'judgment_reasons'
  | 'ai_recommendation'
  | 'assignee_set'
  | 'note_added'
  | 'status_changed'
  | 'evidence_saved'
  | 'completed'
  | 'final_decision';

export type FinalDecision =
  | 'resale_confirmed'
  | 'further_investigation'
  | 'false_positive'
  | 'excluded';

export type InvestigationTimelineEvent = {
  id: string;
  /** 서버는 kind 를 string 으로 저장. 알 수 없는 kind 도 허용. */
  kind: TimelineEventKind | string;
  at: string;
  title: string;
  detail?: string | null;
};

export type InvestigationNote = {
  id: string;
  /** Plain text only */
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
};

export type InvestigationCase = {
  id: string;
  caseNo: string;
  /** 매물/표시 이름 */
  productName: string;
  /** BackOffice 주문 참조 키 */
  orderNo?: string | null;
  contractNo?: string | null;
  customerName?: string | null;
  orderProductName?: string | null;
  listingTitle?: string | null;
  orderUrl?: string | null;
  searchJobId?: string | null;
  searchHistoryId?: string | null;
  aiScore: number;
  status: InvestigationStatus;
  assignee: string | null;
  priority: InvestigationPriority;
  /** 마감일 (YYYY-MM-DD 또는 ISO) */
  dueDate?: string | null;
  siteCode: string;
  /** Case 생성일 */
  createdAt: string;
  /** 매물 등록일 (원본 상품) */
  listedAt?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  /** @deprecated noteEntries 사용 */
  notes?: string | null;
  noteEntries?: InvestigationNote[];
  /** 서버 메트릭(0~1). 없으면 AI Analysis 패널 empty state */
  aiAnalysis?: Partial<InvestigationAiAnalysis>;
  timeline?: InvestigationTimelineEvent[];
  evidence?: InvestigationEvidence[];
  /** D-3 이전 서버 미제공 — 매퍼에서 null */
  finalDecision?: FinalDecision | null;
  decidedAt?: string | null;
  /** Investigation Summary (AI Analysis) — Recommendation 과 분리 */
  investigationSummary?: string | null;
  judgmentReasons?: string[] | null;
  /** AI Recommendation 패널 */
  aiRecommendation?: InvestigationAiRecommendation | null;
};

export type InvestigationAiRecommendation = {
  stars: number;
  headline: string;
  actions: string[];
  reasons: string[];
};

export const INVESTIGATION_STATUSES: InvestigationStatus[] = [
  'Open',
  'Investigating',
  'Review',
  'Completed',
  'Archived',
];

export const INVESTIGATION_PRIORITIES: InvestigationPriority[] = [
  'High',
  'Medium',
  'Low',
];

/** 담당자 후보 (이후 API/조직도 연동) */
export const INVESTIGATION_ASSIGNEES = [
  '김수사',
  '이담당',
  '박조사',
  '최분석',
] as const;

/** GET /api/investigations · /:id 및 쓰기 응답 DTO */
export type ServerInvestigationDto = {
  id: string;
  caseNo: string;
  productName: string;
  order?: { orderNo?: string | null } | null;
  orderNo?: string | null;
  orderUrl?: string | null;
  listingTitle?: string | null;
  aiScore: number;
  aiScorePercent?: number;
  status: InvestigationStatus | string;
  priority: InvestigationPriority | string;
  assignee?: string | null;
  siteCode: string;
  url?: string | null;
  imageUrl?: string | null;
  price?: string | null;
  resultId?: string | null;
  searchHistoryId?: string | null;
  searchJobId?: string | null;
  autoCreated?: boolean;
  timeline?: Array<{
    id?: string;
    kind?: string;
    at?: string;
    title?: string;
    detail?: string | null;
  }>;
  aiAnalysis?: Partial<InvestigationAiAnalysis> | null;
  investigationSummary?: string | null;
  judgmentReasons?: string[] | null;
  aiRecommendation?: InvestigationAiRecommendation | null;
  /** D-3 이후 optional — 매퍼는 부재 시 빈 값 */
  notes?: unknown;
  noteEntries?: unknown;
  finalDecision?: string | null;
  finalDecisionNote?: string | null;
  decidedAt?: string | null;
  dueDate?: string | null;
  createdAt: string | Date;
};

export type InvestigationListResponse = {
  total: number;
  threshold: number;
  items: ServerInvestigationDto[];
};

export type InvestigationConfigResponse = {
  aiScoreThreshold: number;
  autoCreateEnabled: boolean;
};

/** GET /api/investigations/stats */
export type InvestigationStatsResponse = {
  last24h: number;
  byStatus: Record<InvestigationStatus, number>;
};
