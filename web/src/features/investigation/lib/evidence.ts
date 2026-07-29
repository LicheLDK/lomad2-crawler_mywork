import type {
  EvidenceKind,
  InvestigationCase,
  InvestigationEvidence,
  InvestigationTimelineEvent,
  TimelineEventKind,
} from '../types';

function uid(prefix: string) {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function minutesBefore(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}

function minutesAfter(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function event(
  kind: TimelineEventKind,
  at: string,
  title: string,
  detail?: string | null,
): InvestigationTimelineEvent {
  return { id: uid('tl'), kind, at, title, detail: detail ?? null };
}

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  original_url: '원본 URL',
  screenshot: '스크린샷',
  product_image: '상품 이미지',
  ocr: 'OCR',
  html_snapshot: 'HTML Snapshot',
};

export const TIMELINE_KIND_TITLE: Record<TimelineEventKind, string> = {
  search_run: '검색 실행',
  ai_analysis: 'AI 분석 완료',
  investigation_created: 'Investigation 생성',
  ai_rule_warning: 'AI Rule Warning',
  order_mapped: '주문 참조 연결',
  investigation_summary: 'Investigation Summary',
  judgment_reasons: '판단 근거',
  ai_recommendation: 'AI Recommendation',
  assignee_set: '담당자 지정',
  note_added: '메모 작성',
  status_changed: '상태 변경',
  evidence_saved: 'Evidence 저장',
  final_decision: 'Final Decision',
  completed: '완료 처리',
};

/** localStorage에 깨진 한글(???)이 저장된 경우 복구 */
export function looksMojibake(text: string | null | undefined): boolean {
  if (!text) return false;
  return /\?{2,}/.test(text);
}

export function repairEvidenceLabel(
  item: InvestigationEvidence,
): InvestigationEvidence {
  const canonical = EVIDENCE_KIND_LABEL[item.kind];
  if (!canonical) return item;
  if (looksMojibake(item.label) || !item.label?.trim()) {
    return { ...item, label: canonical };
  }
  return item;
}

export function repairTimelineEvent(
  ev: InvestigationTimelineEvent,
): InvestigationTimelineEvent {
  if (!ev.kind) return ev;
  const canonical =
    ev.kind in TIMELINE_KIND_TITLE
      ? TIMELINE_KIND_TITLE[ev.kind as TimelineEventKind]
      : undefined;
  if (!canonical) return ev;
  if (!looksMojibake(ev.title)) return ev;

  let title = canonical;
  if (ev.kind === 'completed' && ev.title.includes('Archived')) {
    title = 'Archived';
  }
  return { ...ev, title };
}

/**
 * Build default timeline (chronological) from case state.
 */
export function buildDefaultTimeline(
  row: Pick<
    InvestigationCase,
    | 'caseNo'
    | 'createdAt'
    | 'status'
    | 'assignee'
    | 'notes'
    | 'noteEntries'
    | 'aiScore'
    | 'productName'
    | 'evidence'
  >,
): InvestigationTimelineEvent[] {
  const created = row.createdAt;
  const events: InvestigationTimelineEvent[] = [
    event(
      'search_run',
      minutesBefore(created, 18),
      '검색 실행',
      row.productName ? `키워드 · ${row.productName}` : null,
    ),
    event(
      'ai_analysis',
      minutesBefore(created, 8),
      'AI 분석 완료',
      `AI Score ${Math.round((row.aiScore ?? 0) * 100)}%`,
    ),
    event(
      'investigation_created',
      created,
      'Investigation 생성',
      row.caseNo,
    ),
    event(
      'evidence_saved',
      minutesAfter(created, 2),
      'Evidence 저장',
      `${row.evidence?.length ?? 5}건 저장`,
    ),
  ];

  if (row.assignee) {
    events.push(
      event(
        'assignee_set',
        minutesAfter(created, 12),
        '담당자 지정',
        row.assignee,
      ),
    );
  }

  if (row.noteEntries && row.noteEntries.length > 0) {
    const first = row.noteEntries[0];
    events.push(
      event(
        'note_added',
        first.createdAt || minutesAfter(created, 25),
        '메모 작성',
        first.body.trim().slice(0, 80) || null,
      ),
    );
  } else if (row.notes?.trim()) {
    events.push(
      event(
        'note_added',
        minutesAfter(created, 25),
        '메모 작성',
        row.notes.trim().slice(0, 80),
      ),
    );
  }

  if (row.status && row.status !== 'Open') {
    events.push(
      event(
        'status_changed',
        minutesAfter(created, 40),
        '상태 변경',
        `Open → ${row.status}`,
      ),
    );
  }

  if (row.status === 'Completed' || row.status === 'Archived') {
    events.push(
      event(
        'completed',
        minutesAfter(created, 90),
        row.status === 'Archived' ? 'Archived' : '완료 처리',
        `${row.caseNo} ${row.status === 'Archived' ? '보관' : '완료 처리'}`,
      ),
    );
  }

  return events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

export function appendTimelineEvent(
  events: InvestigationTimelineEvent[] | undefined,
  kind: TimelineEventKind,
  title: string,
  detail?: string | null,
  at?: string,
): InvestigationTimelineEvent[] {
  const next = [
    ...(events ?? []),
    event(kind, at ?? new Date().toISOString(), title, detail),
  ];
  return next.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

export function buildDefaultEvidence(
  row: Pick<InvestigationCase, 'url' | 'imageUrl' | 'createdAt' | 'productName'>,
): InvestigationEvidence[] {
  const savedAt = row.createdAt;
  const items: InvestigationEvidence[] = [];

  if (row.url) {
    items.push({
      id: uid('ev'),
      kind: 'original_url',
      label: EVIDENCE_KIND_LABEL.original_url,
      value: row.url,
      savedAt,
    });
  }

  items.push({
    id: uid('ev'),
    kind: 'screenshot',
    label: EVIDENCE_KIND_LABEL.screenshot,
    value: row.imageUrl || null,
    savedAt,
  });

  items.push({
    id: uid('ev'),
    kind: 'product_image',
    label: EVIDENCE_KIND_LABEL.product_image,
    value: row.imageUrl || null,
    savedAt,
  });

  items.push({
    id: uid('ev'),
    kind: 'ocr',
    label: EVIDENCE_KIND_LABEL.ocr,
    value: row.productName ? `[OCR]\n${row.productName}` : null,
    savedAt,
  });

  items.push({
    id: uid('ev'),
    kind: 'html_snapshot',
    label: EVIDENCE_KIND_LABEL.html_snapshot,
    value: row.url
      ? `<!DOCTYPE html>\n<html><head><title>${row.productName || 'snapshot'}</title></head><body data-source="${row.url}"></body></html>`
      : null,
    savedAt,
  });

  return items;
}
