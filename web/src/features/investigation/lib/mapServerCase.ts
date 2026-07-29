import type {
  InvestigationCase,
  InvestigationPriority,
  InvestigationStatus,
  ServerInvestigationDto,
} from '../types';
import { INVESTIGATION_STATUSES } from '../types';

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

/**
 * 서버 Investigation DTO → 프론트 InvestigationCase (읽기용 최소 매핑).
 * AI/timeline 세부 정규화는 D-2에서 확장.
 */
export function mapServerCase(dto: ServerInvestigationDto): InvestigationCase {
  const aiScore =
    typeof dto.aiScore === 'number' && Number.isFinite(dto.aiScore)
      ? dto.aiScore
      : 0;
  const createdAt =
    typeof dto.createdAt === 'string'
      ? dto.createdAt
      : new Date(dto.createdAt as unknown as Date).toISOString();

  return {
    id: dto.id,
    caseNo: dto.caseNo,
    productName: dto.productName || dto.listingTitle || '',
    orderNo: dto.orderNo ?? dto.order?.orderNo ?? null,
    orderUrl: dto.orderUrl ?? null,
    listingTitle: dto.listingTitle ?? dto.productName ?? null,
    searchJobId: dto.searchJobId ?? null,
    searchHistoryId: dto.searchHistoryId ?? null,
    aiScore,
    status: normalizeStatus(dto.status),
    assignee: dto.assignee ?? null,
    priority: normalizePriority(dto.priority, aiScore),
    siteCode: dto.siteCode || '',
    createdAt,
    price: dto.price ?? null,
    imageUrl: dto.imageUrl ?? null,
    url: dto.url ?? null,
    aiAnalysis: dto.aiAnalysis ?? undefined,
    timeline: dto.timeline ?? [],
    investigationSummary: dto.investigationSummary ?? null,
    judgmentReasons: dto.judgmentReasons ?? null,
    aiRecommendation: dto.aiRecommendation ?? null,
    noteEntries: [],
    notes: null,
    dueDate: null,
    evidence: [],
    finalDecision: null,
    decidedAt: null,
  };
}
