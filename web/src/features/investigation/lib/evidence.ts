import type {
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
      '?? ??',
      row.productName ? `??? ? ${row.productName}` : null,
    ),
    event(
      'ai_analysis',
      minutesBefore(created, 8),
      'AI ?? ??',
      `AI Score ${Math.round((row.aiScore ?? 0) * 100)}%`,
    ),
    event(
      'investigation_created',
      created,
      'Investigation ??',
      row.caseNo,
    ),
    event(
      'evidence_saved',
      minutesAfter(created, 2),
      'Evidence ??',
      `${row.evidence?.length ?? 5}? ??`,
    ),
  ];

  if (row.assignee) {
    events.push(
      event(
        'assignee_set',
        minutesAfter(created, 12),
        '??? ??',
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
        '?? ??',
        first.body.trim().slice(0, 80) || null,
      ),
    );
  } else if (row.notes?.trim()) {
    events.push(
      event(
        'note_added',
        minutesAfter(created, 25),
        '?? ??',
        row.notes.trim().slice(0, 80),
      ),
    );
  }

  if (row.status && row.status !== 'Open') {
    events.push(
      event(
        'status_changed',
        minutesAfter(created, 40),
        '?? ??',
        `Open ? ${row.status}`,
      ),
    );
  }

  if (row.status === 'Completed' || row.status === 'Archived') {
    events.push(
      event(
        'completed',
        minutesAfter(created, 90),
        row.status === 'Archived' ? 'Archived' : '?? ??',
        `${row.caseNo} ${row.status === 'Archived' ? '??' : '?? ??'}`,
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
      label: '?? URL',
      value: row.url,
      savedAt,
    });
  }

  items.push({
    id: uid('ev'),
    kind: 'screenshot',
    label: '????',
    value: row.imageUrl || null,
    savedAt,
  });

  items.push({
    id: uid('ev'),
    kind: 'product_image',
    label: '?? ???',
    value: row.imageUrl || null,
    savedAt,
  });

  items.push({
    id: uid('ev'),
    kind: 'ocr',
    label: 'OCR',
    value: row.productName ? `[OCR]\n${row.productName}` : null,
    savedAt,
  });

  items.push({
    id: uid('ev'),
    kind: 'html_snapshot',
    label: 'HTML Snapshot',
    value: row.url
      ? `<!DOCTYPE html>\n<html><head><title>${row.productName || 'snapshot'}</title></head><body data-source="${row.url}"></body></html>`
      : null,
    savedAt,
  });

  return items;
}
