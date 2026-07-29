import {
  mapServerCase,
  normalizeAiScore,
} from '../../../web/src/features/investigation/lib/mapServerCase';
import { isCompleteAiAnalysis } from '../../../web/src/features/investigation/lib/ai';
import type { ServerInvestigationDto } from '../../../web/src/features/investigation/types';

function baseDto(
  overrides: Partial<ServerInvestigationDto> = {},
): ServerInvestigationDto {
  return {
    id: 'case-1',
    caseNo: 'CASE-20260729-000001',
    productName: '테스트 매물',
    orderNo: 'ORD-1',
    orderUrl: '/getOrderInfo?order_id=ORD-1',
    listingTitle: '테스트 매물',
    aiScore: 0.87,
    aiScorePercent: 87,
    status: 'Open',
    priority: 'High',
    assignee: null,
    siteCode: 'bungae',
    url: 'https://example.com/item/1',
    imageUrl: null,
    price: '100000',
    timeline: [],
    aiAnalysis: null,
    investigationSummary: null,
    judgmentReasons: null,
    aiRecommendation: null,
    createdAt: '2026-07-29T03:00:00.000Z',
    ...overrides,
  };
}

describe('mapServerCase (D-2 adapter)', () => {
  it('normalizes aiScore 0~1 and 0~100', () => {
    expect(normalizeAiScore(0.87)).toBeCloseTo(0.87);
    expect(normalizeAiScore(87)).toBeCloseTo(0.87);
    expect(normalizeAiScore(null)).toBe(0);
  });

  it('maps server AI analysis / summary / recommendation preferentially', () => {
    const mapped = mapServerCase(
      baseDto({
        aiAnalysis: {
          imageSimilarity: 0.9,
          titleSimilarity: 0.88,
          brandMatch: 0.8,
          modelMatch: 0.7,
          priceSimilarity: 0.6,
          ocrMatch: 0.5,
        },
        investigationSummary: '동일 상품 가능성이 높습니다.',
        judgmentReasons: ['이미지 유사', '브랜드 일치'],
        aiRecommendation: {
          stars: 4,
          headline: '추가 확인을 권장합니다.',
          actions: ['증거 저장'],
          reasons: ['점수 높음'],
        },
      }),
    );

    expect(isCompleteAiAnalysis(mapped.aiAnalysis)).toBe(true);
    expect(mapped.aiAnalysis?.imageSimilarity).toBeCloseTo(0.9);
    expect(mapped.investigationSummary).toBe('동일 상품 가능성이 높습니다.');
    expect(mapped.judgmentReasons).toEqual(['이미지 유사', '브랜드 일치']);
    expect(mapped.aiRecommendation?.headline).toBe('추가 확인을 권장합니다.');
    expect(mapped.aiRecommendation?.stars).toBe(4);
  });

  it('extracts summary and recommendation from timeline when top-level missing', () => {
    const mapped = mapServerCase(
      baseDto({
        investigationSummary: null,
        judgmentReasons: null,
        aiRecommendation: null,
        timeline: [
          {
            id: '1',
            kind: 'investigation_summary',
            at: '2026-07-29T03:01:00.000Z',
            title: 'Investigation Summary',
            detail: '타임라인 요약',
          },
          {
            id: '2',
            kind: 'judgment_reasons',
            at: '2026-07-29T03:01:01.000Z',
            title: '판단 근거',
            detail: '근거A\n근거B',
          },
          {
            id: '3',
            kind: 'ai_recommendation',
            at: '2026-07-29T03:01:02.000Z',
            title: 'AI Recommendation',
            detail: JSON.stringify({
              stars: 5,
              headline: '재판매 가능성 높음',
              actions: ['담당 지정'],
              reasons: ['AI Score 높음'],
            }),
          },
        ],
      }),
    );

    expect(mapped.investigationSummary).toBe('타임라인 요약');
    expect(mapped.judgmentReasons).toEqual(['근거A', '근거B']);
    expect(mapped.aiRecommendation?.headline).toBe('재판매 가능성 높음');
    expect(mapped.aiRecommendation?.stars).toBe(5);
    const recEv = mapped.timeline?.find((e) => e.kind === 'ai_recommendation');
    expect(recEv?.detail).toContain('재판매 가능성 높음');
    expect(recEv?.detail).not.toContain('{');
  });

  it('does not crash when optional workflow fields are absent', () => {
    const mapped = mapServerCase(
      baseDto({
        timeline: undefined,
        aiAnalysis: undefined,
        status: 'Cancelled' as string,
        priority: 'Critical' as string,
        createdAt: new Date('2026-07-29T04:00:00.000Z'),
      }),
    );

    expect(mapped.noteEntries).toEqual([]);
    expect(mapped.notes).toBeNull();
    expect(mapped.finalDecision).toBeNull();
    expect(mapped.decidedAt).toBeNull();
    expect(mapped.dueDate).toBeNull();
    expect(mapped.evidence).toEqual([]);
    expect(mapped.timeline).toEqual([]);
    expect(mapped.status).toBe('Archived');
    expect(mapped.priority).toBe('High');
    expect(mapped.createdAt).toBe('2026-07-29T04:00:00.000Z');
  });

  it('maps notes, dueDate, finalDecision from server (D-5)', () => {
    const mapped = mapServerCase(
      baseDto({
        notes: [
          {
            id: 'n1',
            body: '첫 메모',
            author: '김수사',
            createdAt: '2026-07-29T05:00:00.000Z',
            updatedAt: '2026-07-29T05:00:00.000Z',
          },
          {
            id: 'n2',
            body: '나중 메모',
            author: '이담당',
            createdAt: '2026-07-29T06:00:00.000Z',
            updatedAt: '2026-07-29T06:30:00.000Z',
          },
        ],
        dueDate: '2026-08-01T00:00:00.000Z',
        finalDecision: 'resale_confirmed',
        decidedAt: '2026-07-29T07:00:00.000Z',
      }),
    );

    expect(mapped.noteEntries?.map((n) => n.id)).toEqual(['n2', 'n1']);
    expect(mapped.noteEntries?.[0]?.body).toBe('나중 메모');
    expect(mapped.dueDate).toBe('2026-08-01T00:00:00.000Z');
    expect(mapped.finalDecision).toBe('resale_confirmed');
    expect(mapped.decidedAt).toBe('2026-07-29T07:00:00.000Z');
    expect(mapped.evidence).toEqual([]);
  });

  it('keeps server timeline kinds for Drawer display', () => {
    const mapped = mapServerCase(
      baseDto({
        timeline: [
          {
            id: 'a',
            kind: 'ai_rule_warning',
            at: '2026-07-29T03:00:00.000Z',
            title: 'AI Rule Warning',
            detail: 'price too low',
          },
          {
            id: 'b',
            kind: 'order_mapped',
            at: '2026-07-29T03:00:01.000Z',
            title: '주문 참조 연결',
            detail: 'orderNo=ORD-1',
          },
        ],
      }),
    );

    expect(mapped.timeline?.map((e) => e.kind)).toEqual([
      'ai_rule_warning',
      'order_mapped',
    ]);
  });
});
