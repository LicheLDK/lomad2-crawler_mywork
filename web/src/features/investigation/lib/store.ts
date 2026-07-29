import type { SearchResult } from '../../../types';
import type {
  InvestigationAiAnalysis,
  InvestigationCase,
  InvestigationNote,
  InvestigationPriority,
  InvestigationStatus,
  FinalDecision,
} from '../types';
import { MOCK_INVESTIGATION_CASES } from '../data/mock';
import { deriveAiAnalysis } from './ai';
import {
  appendTimelineEvent,
  buildDefaultEvidence,
  buildDefaultTimeline,
  looksMojibake,
  repairEvidenceLabel,
  repairTimelineEvent,
} from './evidence';
import {
  canTransitionStatus,
  isInvestigationLocked,
} from './workflow';

const CASES_KEY = 'crawler.dashboard.investigation.cases';
const SEQ_KEY = 'crawler.dashboard.investigation.seq';
const SEEDED_KEY = 'crawler.dashboard.investigation.seeded.v6';

function uid(prefix: string) {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function migrateNotes(row: InvestigationCase): InvestigationNote[] {
  if (row.noteEntries && row.noteEntries.length > 0) {
    return row.noteEntries;
  }
  if (row.notes?.trim()) {
    const at = row.createdAt;
    return [
      {
        id: `legacy-note-${row.id}`,
        body: row.notes.trim(),
        author: row.assignee?.trim() || '미지정',
        createdAt: at,
        updatedAt: at,
      },
    ];
  }
  return [];
}

function priorityFromScore(score: number): InvestigationPriority {
  if (score >= 0.8) return 'High';
  if (score >= 0.6) return 'Medium';
  return 'Low';
}

function normalizePriority(
  value: InvestigationPriority | string | undefined,
): InvestigationPriority {
  if (value === 'Critical' || value === 'High') return 'High';
  if (value === 'Low') return 'Low';
  if (value === 'Medium') return 'Medium';
  return 'Medium';
}

function analysisFromResult(
  row: SearchResult,
  aiScore: number,
): InvestigationAiAnalysis {
  const title =
    row.titleSimilarity != null && Number.isFinite(row.titleSimilarity)
      ? row.titleSimilarity
      : undefined;
  const image =
    row.imageSimilarity != null && Number.isFinite(row.imageSimilarity)
      ? row.imageSimilarity
      : undefined;
  return deriveAiAnalysis(aiScore, {
    titleSimilarity: title,
    imageSimilarity: image,
    priceSimilarity:
      row.price != null && row.price !== ''
        ? Math.min(1, (title ?? aiScore) * 0.85 + 0.1)
        : 0.35,
  });
}

export const INVESTIGATION_CHANGED = 'investigation:changed';

function emitChanged() {
  window.dispatchEvent(new Event(INVESTIGATION_CHANGED));
}

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** CASE-20260724-000001 */
export function nextCaseNumber(): string {
  const day = todayStamp();
  let seq = 1;
  try {
    const raw = JSON.parse(localStorage.getItem(SEQ_KEY) || '{}') as {
      day?: string;
      seq?: number;
    };
    if (raw.day === day && typeof raw.seq === 'number') {
      seq = raw.seq + 1;
    }
  } catch {
    /* ignore */
  }
  localStorage.setItem(SEQ_KEY, JSON.stringify({ day, seq }));
  return `CASE-${day}-${String(seq).padStart(6, '0')}`;
}

function normalizeCase(row: InvestigationCase): InvestigationCase {
  const aiScore = row.aiScore ?? 0;
  const noteEntries = migrateNotes(row);
  // legacy Cancelled → Archived
  const rawStatus = (row.status as string) === 'Cancelled' ? 'Archived' : row.status;
  const base: InvestigationCase = {
    ...row,
    status: rawStatus,
    priority: normalizePriority(row.priority ?? priorityFromScore(aiScore)),
    dueDate: row.dueDate ?? null,
    listedAt: row.listedAt ?? null,
    price: row.price ?? null,
    imageUrl: row.imageUrl ?? null,
    orderNo: row.orderNo ?? null,
    contractNo: row.contractNo ?? null,
    customerName: row.customerName ?? null,
    orderProductName: row.orderProductName ?? row.productName ?? null,
    listingTitle: row.listingTitle ?? row.productName ?? null,
    orderUrl: row.orderUrl ?? null,
    aiAnalysis: deriveAiAnalysis(aiScore, row.aiAnalysis),
    noteEntries,
    notes:
      noteEntries.map((n) => n.body.trim()).filter(Boolean).join('\n\n') ||
      null,
  };

  const evidence = (
    row.evidence != null ? row.evidence : buildDefaultEvidence(base)
  ).map(repairEvidenceLabel);

  const withEvidence = { ...base, evidence };

  const timelineNeedsRebuild =
    row.timeline == null ||
    row.timeline.length === 0 ||
    row.timeline.some((e) => !e.kind);

  const timeline = timelineNeedsRebuild
    ? buildDefaultTimeline(withEvidence)
    : row.timeline.map(repairTimelineEvent);

  return {
    ...withEvidence,
    timeline,
    evidence,
    noteEntries: noteEntries.map((n) =>
      looksMojibake(n.author) ? { ...n, author: '미지정' } : n,
    ),
  };
}

export function loadInvestigationCases(): InvestigationCase[] {
  try {
    if (!localStorage.getItem(SEEDED_KEY)) {
      localStorage.setItem(CASES_KEY, JSON.stringify(MOCK_INVESTIGATION_CASES));
      localStorage.setItem(SEEDED_KEY, '1');
    }
    const raw = JSON.parse(localStorage.getItem(CASES_KEY) || '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const before = raw as InvestigationCase[];
    const normalized = before.map(normalizeCase);
    const needsPersist = before.some((row, i) => {
      const next = normalized[i];
      const evBroken = (row.evidence ?? []).some((e) => looksMojibake(e.label));
      const tlBroken = (row.timeline ?? []).some((e) => looksMojibake(e.title));
      return (
        evBroken ||
        tlBroken ||
        JSON.stringify(row.evidence) !== JSON.stringify(next.evidence) ||
        JSON.stringify(row.timeline) !== JSON.stringify(next.timeline)
      );
    });
    if (needsPersist) {
      try {
        localStorage.setItem(CASES_KEY, JSON.stringify(normalized));
      } catch {
        /* ignore quota */
      }
    }
    return normalized;
  } catch {
    return [];
  }
}

function saveCases(cases: InvestigationCase[]) {
  localStorage.setItem(CASES_KEY, JSON.stringify(cases));
  emitChanged();
}

export function updateInvestigationCase(
  id: string,
  patch: Partial<InvestigationCase>,
): InvestigationCase | null {
  const all = loadInvestigationCases();
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  if (isInvestigationLocked(all[idx].status) && patch.status == null) {
    return null;
  }
  const next = normalizeCase({ ...all[idx], ...patch, id });
  all[idx] = next;
  saveCases(all);
  return next;
}

export function changeInvestigationStatus(
  caseId: string,
  nextStatus: InvestigationStatus,
): InvestigationCase | null {
  const all = loadInvestigationCases();
  const idx = all.findIndex((c) => c.id === caseId);
  if (idx < 0) return null;
  const current = all[idx];
  if (!canTransitionStatus(current.status, nextStatus)) return null;
  if (current.status === nextStatus) return current;

  const now = new Date().toISOString();
  let timeline = appendTimelineEvent(
    current.timeline,
    'status_changed',
    '상태 변경',
    `${current.status} → ${nextStatus}`,
    now,
  );

  if (nextStatus === 'Completed') {
    timeline = appendTimelineEvent(
      timeline,
      'completed',
      '완료 처리',
      `${current.caseNo} 완료 처리`,
      now,
    );
  }

  if (nextStatus === 'Archived') {
    timeline = appendTimelineEvent(
      timeline,
      'completed',
      'Archived',
      `${current.caseNo} 보관`,
      now,
    );
  }

  const next: InvestigationCase = {
    ...current,
    status: nextStatus,
    timeline,
  };
  all[idx] = next;
  saveCases(all);
  return next;
}

const FINAL_DECISION_LABEL: Record<FinalDecision, string> = {
  resale_confirmed: '재판매 확인',
  further_investigation: '추가 조사',
  false_positive: '오탐',
  excluded: '제외',
};

/** Final Decision → Completed + Timeline */
export function applyFinalDecision(
  caseId: string,
  decision: FinalDecision,
): InvestigationCase | null {
  const all = loadInvestigationCases();
  const idx = all.findIndex((c) => c.id === caseId);
  if (idx < 0) return null;
  const current = all[idx];
  if (current.status === 'Archived') return null;
  if (current.status === 'Completed' && current.finalDecision) return null;

  const now = new Date().toISOString();
  const label = FINAL_DECISION_LABEL[decision];
  let timeline = current.timeline;

  if (current.status !== 'Completed') {
    timeline = appendTimelineEvent(
      timeline,
      'status_changed',
      '상태 변경',
      `${current.status} → Completed`,
      now,
    );
  }

  timeline = appendTimelineEvent(
    timeline,
    'final_decision',
    'Final Decision',
    label,
    now,
  );

  timeline = appendTimelineEvent(
    timeline,
    'completed',
    '완료 처리',
    `${current.caseNo} · ${label}`,
    now,
  );

  const next: InvestigationCase = {
    ...current,
    status: 'Completed',
    finalDecision: decision,
    decidedAt: now,
    timeline,
  };
  all[idx] = next;
  saveCases(all);
  return next;
}

export function updateInvestigationAssignment(
  caseId: string,
  patch: {
    assignee?: string | null;
    priority?: InvestigationPriority;
    dueDate?: string | null;
  },
): InvestigationCase | null {
  const all = loadInvestigationCases();
  const idx = all.findIndex((c) => c.id === caseId);
  if (idx < 0) return null;
  const current = all[idx];
  if (isInvestigationLocked(current.status)) return null;

  const now = new Date().toISOString();
  let timeline = current.timeline;
  const nextAssignee =
    patch.assignee !== undefined ? patch.assignee : current.assignee;

  if (
    patch.assignee !== undefined &&
    (patch.assignee || null) !== (current.assignee || null)
  ) {
    const detail = patch.assignee
      ? current.assignee
        ? `${current.assignee} → ${patch.assignee}`
        : patch.assignee
      : `${current.assignee || '미지정'} → 미지정`;
    timeline = appendTimelineEvent(
      current.timeline,
      'assignee_set',
      '담당자 지정',
      detail,
      now,
    );
  }

  const next: InvestigationCase = {
    ...current,
    assignee: nextAssignee ?? null,
    priority:
      patch.priority !== undefined
        ? normalizePriority(patch.priority)
        : current.priority,
    dueDate:
      patch.dueDate !== undefined ? patch.dueDate : (current.dueDate ?? null),
    timeline,
  };
  all[idx] = next;
  saveCases(all);
  return next;
}

export function deleteInvestigationEvidence(
  caseId: string,
  evidenceId: string,
): InvestigationCase | null {
  const all = loadInvestigationCases();
  const idx = all.findIndex((c) => c.id === caseId);
  if (idx < 0) return null;
  const current = all[idx];
  if (isInvestigationLocked(current.status)) return null;
  const next: InvestigationCase = {
    ...current,
    evidence: (current.evidence ?? []).filter((e) => e.id !== evidenceId),
  };
  all[idx] = next;
  saveCases(all);
  return next;
}

export function addInvestigationNote(
  caseId: string,
  body: string,
  author: string,
): InvestigationCase | null {
  const all = loadInvestigationCases();
  const idx = all.findIndex((c) => c.id === caseId);
  if (idx < 0) return null;
  if (isInvestigationLocked(all[idx].status)) return null;
  const current = all[idx];
  const now = new Date().toISOString();
  const note: InvestigationNote = {
    id: uid('note'),
    body,
    author: author.trim() || '미지정',
    createdAt: now,
    updatedAt: now,
  };
  const noteEntries = [note, ...(current.noteEntries ?? [])];
  const next: InvestigationCase = {
    ...current,
    noteEntries,
    notes:
      noteEntries.map((n) => n.body.trim()).filter(Boolean).join('\n\n') ||
      null,
  };
  all[idx] = next;
  saveCases(all);
  return next;
}

export function updateInvestigationNote(
  caseId: string,
  noteId: string,
  body: string,
): InvestigationCase | null {
  const all = loadInvestigationCases();
  const idx = all.findIndex((c) => c.id === caseId);
  if (idx < 0) return null;
  if (isInvestigationLocked(all[idx].status)) return null;
  const current = all[idx];
  const prev = (current.noteEntries ?? []).find((n) => n.id === noteId);
  if (!prev) return null;

  const now = new Date().toISOString();
  const noteEntries = (current.noteEntries ?? []).map((n) =>
    n.id === noteId ? { ...n, body, updatedAt: now } : n,
  );

  let timeline = current.timeline;
  if (!prev.body.trim() && body.trim()) {
    timeline = appendTimelineEvent(
      current.timeline,
      'note_added',
      '메모 작성',
      body.trim().slice(0, 80),
      now,
    );
  }

  const next: InvestigationCase = {
    ...current,
    noteEntries,
    notes:
      noteEntries.map((n) => n.body.trim()).filter(Boolean).join('\n\n') ||
      null,
    timeline,
  };
  all[idx] = next;
  saveCases(all);
  return next;
}

export function deleteInvestigationNote(
  caseId: string,
  noteId: string,
): InvestigationCase | null {
  const all = loadInvestigationCases();
  const idx = all.findIndex((c) => c.id === caseId);
  if (idx < 0) return null;
  if (isInvestigationLocked(all[idx].status)) return null;
  const current = all[idx];
  const noteEntries = (current.noteEntries ?? []).filter((n) => n.id !== noteId);
  const next: InvestigationCase = {
    ...current,
    noteEntries,
    notes:
      noteEntries.map((n) => n.body.trim()).filter(Boolean).join('\n\n') ||
      null,
  };
  all[idx] = next;
  saveCases(all);
  return next;
}

export function createInvestigationFromResult(
  row: SearchResult,
): InvestigationCase {
  const aiScore =
    row.titleSimilarity != null && Number.isFinite(row.titleSimilarity)
      ? row.titleSimilarity
      : row.imageSimilarity != null && Number.isFinite(row.imageSimilarity)
        ? row.imageSimilarity
        : 0;

  const draft: InvestigationCase = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `inv-${Date.now()}`,
    caseNo: nextCaseNumber(),
    productName: row.title,
    orderProductName: row.title,
    listingTitle: row.title,
    orderNo: null,
    contractNo: null,
    customerName: null,
    orderUrl: null,
    aiScore,
    status: 'Open',
    assignee: null,
    priority: priorityFromScore(aiScore),
    siteCode: row.siteCode,
    createdAt: new Date().toISOString(),
    listedAt: row.createdAt ?? null,
    price: row.price,
    imageUrl: row.screenshotUrl || row.imageUrl || null,
    url: row.url,
    aiAnalysis: analysisFromResult(row, aiScore),
    noteEntries: [],
    dueDate: null,
  };

  const created = normalizeCase(draft);
  const all = loadInvestigationCases();
  all.unshift(created);
  saveCases(all);
  return created;
}
