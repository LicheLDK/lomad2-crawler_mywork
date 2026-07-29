import type {
  FinalDecision,
  InvestigationAiAnalysis,
  InvestigationAiRecommendation,
  InvestigationCase,
  InvestigationNote,
  InvestigationPriority,
  InvestigationStatus,
  InvestigationTimelineEvent,
  ServerInvestigationDto,
} from '../types';
import { INVESTIGATION_STATUSES } from '../types';

const FINAL_DECISIONS: FinalDecision[] = [
  'resale_confirmed',
  'further_investigation',
  'false_positive',
  'excluded',
];

const AI_ANALYSIS_KEYS: (keyof InvestigationAiAnalysis)[] = [
  'imageSimilarity',
  'titleSimilarity',
  'brandMatch',
  'modelMatch',
  'priceSimilarity',
  'ocrMatch',
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * 서버 aiScore 는 0~1. 잘못 전달된 0~100 도 방어적으로 정규화.
 */
export function normalizeAiScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value > 1 && value <= 100) return clamp01(value / 100);
  return clamp01(value);
}

function normalizeStatus(value: string | undefined): InvestigationStatus {
  if (value && (INVESTIGATION_STATUSES as string[]).includes(value)) {
    return value as InvestigationStatus;
  }
  if (value === 'Cancelled') return 'Archived';
  return 'Open';
}

function normalizePriority(
  value: string | undefined,
  aiScore: number,
): InvestigationPriority {
  if (value === 'Critical' || value === 'High') return 'High';
  if (value === 'Low') return 'Low';
  if (value === 'Medium') return 'Medium';
  if (aiScore >= 0.8) return 'High';
  if (aiScore >= 0.6) return 'Medium';
  return 'Low';
}

function toIso(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value === 'string' && value.trim()) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t).toISOString() : value;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  return fallback;
}

function defaultOrderUrl(orderNo: string | null | undefined): string | null {
  if (!orderNo?.trim()) return null;
  return `/getOrderInfo?order_id=${encodeURIComponent(orderNo.trim())}`;
}

/** 메트릭이 하나라도 있으면 객체로 반환. 전부 없으면 undefined. */
export function mapAiAnalysis(
  raw: Partial<InvestigationAiAnalysis> | null | undefined,
): Partial<InvestigationAiAnalysis> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<InvestigationAiAnalysis> = {};
  let any = false;
  for (const key of AI_ANALYSIS_KEYS) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = normalizeAiScore(v);
      any = true;
    }
  }
  return any ? out : undefined;
}

export function mapAiRecommendation(
  raw: InvestigationAiRecommendation | null | undefined,
): InvestigationAiRecommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const headline = String(raw.headline ?? '').trim();
  if (!headline) return null;
  const starsRaw =
    typeof raw.stars === 'number' && Number.isFinite(raw.stars) ? raw.stars : 3;
  return {
    stars: Math.max(1, Math.min(5, Math.round(starsRaw))),
    headline,
    actions: Array.isArray(raw.actions)
      ? raw.actions.filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0,
        )
      : [],
    reasons: Array.isArray(raw.reasons)
      ? raw.reasons.filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0,
        )
      : [],
  };
}

function extractOpinionFromTimeline(timeline: InvestigationTimelineEvent[]): {
  summary: string | null;
  reasons: string[];
} {
  let summary: string | null = null;
  let reasons: string[] = [];
  for (const ev of timeline) {
    if (ev.kind === 'investigation_summary' && ev.detail?.trim()) {
      summary = ev.detail.trim();
    }
    if (ev.kind === 'judgment_reasons' && ev.detail?.trim()) {
      reasons = ev.detail
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { summary, reasons };
}

function extractRecommendationFromTimeline(
  timeline: InvestigationTimelineEvent[],
): InvestigationAiRecommendation | null {
  for (const ev of timeline) {
    if (ev.kind !== 'ai_recommendation' || !ev.detail) continue;
    try {
      const parsed = JSON.parse(ev.detail) as InvestigationAiRecommendation;
      return mapAiRecommendation(parsed);
    } catch {
      /* ignore malformed */
    }
  }
  return null;
}

function formatTimelineDetail(
  kind: string,
  detail: string | null | undefined,
): string | null {
  if (!detail?.trim()) return null;
  if (kind !== 'ai_recommendation') return detail;
  try {
    const parsed = JSON.parse(detail) as {
      headline?: string;
      stars?: number;
      actions?: string[];
    };
    const headline = String(parsed.headline ?? '').trim();
    if (!headline) return detail;
    const stars =
      typeof parsed.stars === 'number' && Number.isFinite(parsed.stars)
        ? Math.max(1, Math.min(5, Math.round(parsed.stars)))
        : null;
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.filter((x): x is string => typeof x === 'string')
      : [];
    const parts = [
      stars != null ? `★${stars}` : null,
      headline,
      actions.length ? `추천: ${actions.join(', ')}` : null,
    ].filter(Boolean);
    return parts.join(' · ');
  } catch {
    return detail;
  }
}

export function mapNotes(raw: unknown): InvestigationNote[] {
  if (!Array.isArray(raw)) return [];
  const notes = raw
    .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
    .map((n, index) => {
      const id =
        typeof n.id === 'string' && n.id.trim() ? n.id : `note-${index}`;
      const body = typeof n.body === 'string' ? n.body : '';
      const author =
        typeof n.author === 'string' && n.author.trim()
          ? n.author
          : '담당자';
      const createdAt = toIso(n.createdAt);
      const updatedAt = toIso(n.updatedAt, createdAt);
      return { id, body, author, createdAt, updatedAt };
    });
  return notes.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function mapFinalDecision(raw: unknown): FinalDecision | null {
  if (typeof raw !== 'string') return null;
  return (FINAL_DECISIONS as string[]).includes(raw)
    ? (raw as FinalDecision)
    : null;
}

export function mapTimeline(
  raw: ServerInvestigationDto['timeline'] | InvestigationTimelineEvent[] | null | undefined,
): InvestigationTimelineEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((ev): ev is NonNullable<typeof ev> => !!ev && typeof ev === 'object')
    .map((ev, index) => {
      const kind =
        'kind' in ev && typeof ev.kind === 'string' && ev.kind
          ? ev.kind
          : 'unknown';
      const detail = formatTimelineDetail(
        kind,
        'detail' in ev && typeof ev.detail === 'string' ? ev.detail : null,
      );
      const id =
        'id' in ev && typeof ev.id === 'string' && ev.id.trim()
          ? ev.id
          : `tl-${index}-${kind}`;
      const at = 'at' in ev ? toIso(ev.at) : toIso(undefined);
      const title =
        'title' in ev && typeof ev.title === 'string' && ev.title.trim()
          ? ev.title
          : kind;
      return { id, kind, at, title, detail };
    });
}

/**
 * 서버 Investigation DTO → 프론트 InvestigationCase.
 * 목록·상세·Provider 모두 이 함수만 경유한다.
 *
 * D6/D-7: aiAnalysis / investigationSummary / aiRecommendation 은 서버 값만.
 * D-5: notes / dueDate / finalDecision / decidedAt 은 서버 값 매핑 (부재 시 빈 값).
 * Evidence는 서버 테이블 없음 — 빈 배열 유지 (편집 disabled).
 */
export function mapServerCase(dto: ServerInvestigationDto): InvestigationCase {
  const aiScore = normalizeAiScore(dto.aiScore);
  const createdAt = toIso(dto.createdAt);
  const orderNo = dto.orderNo ?? dto.order?.orderNo ?? null;
  const rawTimeline = Array.isArray(dto.timeline) ? dto.timeline : [];
  // 포맷 전에 raw timeline 에서 summary/recommendation 추출 (detail JSON 유지)
  const preMappedForExtract: InvestigationTimelineEvent[] = rawTimeline
    .filter((ev): ev is NonNullable<typeof ev> => !!ev && typeof ev === 'object')
    .map((ev, index) => ({
      id:
        typeof ev.id === 'string' && ev.id.trim()
          ? ev.id
          : `tl-${index}`,
      kind: typeof ev.kind === 'string' && ev.kind ? ev.kind : 'unknown',
      at: toIso(ev.at),
      title:
        typeof ev.title === 'string' && ev.title.trim() ? ev.title : 'event',
      detail: typeof ev.detail === 'string' ? ev.detail : null,
    }));
  const fromTimeline = extractOpinionFromTimeline(preMappedForExtract);
  const timeline = mapTimeline(dto.timeline);

  const summaryFromDto =
    typeof dto.investigationSummary === 'string'
      ? dto.investigationSummary.trim() || null
      : null;
  const reasonsFromDto = Array.isArray(dto.judgmentReasons)
    ? dto.judgmentReasons.filter(
        (r): r is string => typeof r === 'string' && Boolean(r.trim()),
      )
    : null;

  const aiRecommendation =
    mapAiRecommendation(dto.aiRecommendation) ??
    extractRecommendationFromTimeline(preMappedForExtract);

  const aiAnalysis = mapAiAnalysis(dto.aiAnalysis ?? undefined);

  return {
    id: dto.id,
    caseNo: dto.caseNo,
    productName: dto.productName || dto.listingTitle || '',
    orderNo,
    orderUrl: dto.orderUrl?.trim() || defaultOrderUrl(orderNo),
    listingTitle: dto.listingTitle ?? dto.productName ?? null,
    searchJobId: dto.searchJobId ?? null,
    searchHistoryId: dto.searchHistoryId ?? null,
    aiScore,
    status: normalizeStatus(
      typeof dto.status === 'string' ? dto.status : undefined,
    ),
    assignee: dto.assignee ?? null,
    priority: normalizePriority(
      typeof dto.priority === 'string' ? dto.priority : undefined,
      aiScore,
    ),
    siteCode: dto.siteCode || '',
    createdAt,
    price: dto.price ?? null,
    imageUrl: dto.imageUrl ?? null,
    url: dto.url ?? null,
    aiAnalysis,
    timeline,
    investigationSummary: summaryFromDto ?? fromTimeline.summary,
    judgmentReasons:
      reasonsFromDto && reasonsFromDto.length > 0
        ? reasonsFromDto
        : fromTimeline.reasons.length > 0
          ? fromTimeline.reasons
          : null,
    aiRecommendation,
    noteEntries: mapNotes(dto.notes ?? dto.noteEntries),
    notes: null,
    dueDate: dto.dueDate != null ? toIso(dto.dueDate) : null,
    evidence: [],
    finalDecision: mapFinalDecision(dto.finalDecision),
    decidedAt: dto.decidedAt != null ? toIso(dto.decidedAt) : null,
  };
}
