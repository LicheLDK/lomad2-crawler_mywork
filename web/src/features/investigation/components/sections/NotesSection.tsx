import { useEffect, useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { formatTime } from '../../../../lib/format';
import {
  addInvestigationNote,
  deleteInvestigationNote,
  updateInvestigationNote,
} from '../../lib/store';
import type {
  InvestigationCase,
  InvestigationNote,
} from '../../types';
import { Badge } from '../../../../components/ui/badge';
import { toast } from '../../../../components/Toast';

const AUTOSAVE_MS = 600;

function defaultAuthor(row: InvestigationCase) {
  return row.assignee?.trim() || '조사관';
}

function NoteEditor({
  noteId,
  initial,
  authorHint,
  onSave,
  onCancel,
  autoFocus,
}: {
  noteId: string;
  initial: string;
  authorHint: string;
  onSave: (body: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState(initial);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const lastSaved = useRef(initial);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setBody(initial);
    lastSaved.current = initial;
    setSaveState('idle');
  }, [noteId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when switching notes

  useEffect(() => {
    if (body === lastSaved.current) return;
    setSaveState('saving');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      onSaveRef.current(body);
      lastSaved.current = body;
      setSaveState('saved');
    }, AUTOSAVE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [body]);

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        autoFocus={autoFocus}
        rows={4}
        spellCheck={false}
        placeholder="메모를 입력하세요 (Plain text)"
        className="w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-ink-800 outline-none transition placeholder:text-ink-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-400">
          작성자 · {authorHint}
          {saveState === 'saving'
            ? ' · 저장 중…'
            : saveState === 'saved'
              ? ' · 자동 저장됨'
              : ''}
        </p>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-xs text-ink-500 transition hover:bg-sand-100 hover:text-ink-800"
          >
            닫기
          </button>
        ) : null}
      </div>
    </div>
  );
}

function NoteCard({
  note,
  caseId,
  authorHint,
  readOnly = false,
}: {
  note: InvestigationNote;
  caseId: string;
  authorHint: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  function handleSave(body: string) {
    if (readOnly) return;
    updateInvestigationNote(caseId, note.id, body);
  }

  function handleDelete() {
    if (readOnly) return;
    deleteInvestigationNote(caseId, note.id);
    toast('메모를 삭제했습니다.');
  }

  return (
    <li className="rounded-xl border border-ink-100 bg-white p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-700">{note.author}</p>
          <p className="text-[11px] tabular-nums text-ink-400">
            작성 · {formatTime(note.createdAt)}
            {note.updatedAt !== note.createdAt
              ? ` · 수정 · ${formatTime(note.updatedAt)}`
              : ''}
          </p>
        </div>
        {!readOnly ? (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded-lg p-1.5 text-ink-500 transition hover:bg-sand-100 hover:text-ink-800"
              aria-label="메모 수정"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg p-1.5 text-rose-600 transition hover:bg-rose-50"
              aria-label="메모 삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {editing && !readOnly ? (
        <NoteEditor
          noteId={note.id}
          initial={note.body}
          authorHint={authorHint}
          autoFocus
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
          {note.body.trim() ? (
            note.body
          ) : (
            <span className="text-ink-400">(빈 메모)</span>
          )}
        </p>
      )}
    </li>
  );
}

export function InvestigationNotesPanel({
  row,
  readOnly = false,
}: {
  row: InvestigationCase;
  readOnly?: boolean;
}) {
  const notes = row.noteEntries ?? [];
  const author = defaultAuthor(row);
  const [draftId, setDraftId] = useState<string | null>(null);

  useEffect(() => {
    setDraftId(null);
  }, [row.id]);

  function startCompose() {
    if (readOnly) return;
    const created = addInvestigationNote(row.id, '', author);
    if (!created) return;
    const newest = created.noteEntries?.[0];
    setDraftId(newest?.id ?? null);
  }

  const draftNote = draftId
    ? notes.find((n) => n.id === draftId)
    : undefined;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
          Investigation Notes
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{notes.length}</Badge>
          {!readOnly ? (
            <button
              type="button"
              onClick={startCompose}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-700 transition hover:bg-sand-50"
            >
              <Plus className="h-3.5 w-3.5" />
              메모 작성
            </button>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <p className="text-xs text-ink-400">
          쓰기 API 연결 전 — 메모는 읽기 전용입니다.
        </p>
      ) : null}

      {draftNote && !readOnly ? (
        <div className="rounded-xl border border-teal-200/80 bg-teal-50/40 p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-teal-800">
            새 메모 · Plain text · 자동 저장
          </p>
          <NoteEditor
            noteId={draftNote.id}
            initial={draftNote.body}
            authorHint={author}
            autoFocus
            onSave={(body) =>
              updateInvestigationNote(row.id, draftNote.id, body)
            }
            onCancel={() => {
              if (!draftNote.body.trim()) {
                deleteInvestigationNote(row.id, draftNote.id);
              }
              setDraftId(null);
            }}
          />
        </div>
      ) : null}

      <ul className="space-y-2">
        {notes.filter((n) => n.id !== draftId).length === 0 && !draftNote ? (
          <li className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-6 text-center text-sm text-ink-400">
            작성된 메모가 없습니다.
          </li>
        ) : (
          notes
            .filter((n) => n.id !== draftId)
            .map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                caseId={row.id}
                authorHint={author}
                readOnly={readOnly}
              />
            ))
        )}
      </ul>
    </section>
  );
}
