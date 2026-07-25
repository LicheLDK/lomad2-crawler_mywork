import { useEffect, useRef, useState } from 'react';
import { ExternalLink, ImageOff, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { resolveAssetUrl } from '../../../api';
import { formatPrice, formatTime, siteLabel, siteTone } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Separator } from '../../../components/ui/separator';
import type {
  InvestigationCase,
  InvestigationPriority,
} from '../types';
import { isInvestigationLocked } from '../lib/workflow';
import { StatusBadge } from './StatusBadge';
import { InvestigationAiPanel } from './sections/AiAnalysisSection';
import { InvestigationRecommendationPanel } from './sections/RecommendationSection';
import { InvestigationSummaryPanel } from './sections/SummarySection';
import { InvestigationTimeline } from './sections/TimelineSection';
import { InvestigationEvidencePanel } from './sections/EvidenceSection';
import { InvestigationNotesPanel } from './sections/NotesSection';
import { InvestigationWorkflowPanel } from './sections/WorkflowSection';
import { InvestigationAssignmentPanel } from './sections/AssignmentSection';
import { InvestigationFinalDecisionPanel } from './sections/FinalDecisionSection';
import { InvestigationOrderPanel } from './sections/OrderSection';
import { cn } from '../../../lib/utils';

type SectionId = 'overview' | 'ai' | 'evidence' | 'timeline' | 'work';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'ai', label: 'AI' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'work', label: 'Work' },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-800">{children}</dd>
    </div>
  );
}

function priorityBadgeVariant(
  p: InvestigationPriority,
): 'destructive' | 'default' | 'secondary' {
  if (p === 'High') return 'destructive';
  if (p === 'Medium') return 'default';
  return 'secondary';
}

/**
 * Case Detail Drawer — 대부분의 Case 작업은 여기서 수행 (페이지 이동 없음)
 * AI / Evidence / Timeline 은 sticky 섹션 네비로 항상 접근 가능
 */
export function CaseDrawer({
  row,
  onClose,
}: {
  row: InvestigationCase | null;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [active, setActive] = useState<SectionId>('overview');
  const refs = useRef<Record<SectionId, HTMLElement | null>>({
    overview: null,
    ai: null,
    evidence: null,
    timeline: null,
    work: null,
  });

  useEffect(() => {
    if (!row) return;
    setActive('overview');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [row?.id]);

  if (!row || typeof document === 'undefined') return null;

  const imageSrc = resolveAssetUrl(row.imageUrl) || row.imageUrl || null;
  const priority = row.priority ?? 'Medium';
  const locked = isInvestigationLocked(row.status);

  function handleClose(e?: React.SyntheticEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    window.setTimeout(() => onCloseRef.current(), 0);
  }

  function jump(id: SectionId) {
    setActive(id);
    refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Investigation case"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink-950/25"
        aria-label="닫기"
        onClick={handleClose}
      />

      <aside
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-ink-100 bg-[#fbfaf7] shadow-2xl sm:max-w-lg"
        style={{ maxHeight: '100dvh' }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <header className="relative z-20 flex shrink-0 items-start justify-between gap-3 border-b border-ink-100 bg-[#fbfaf7] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
              Case
            </p>
            <h2 className="mt-1 font-display text-xl tabular-nums text-ink-900">
              {row.caseNo}
            </h2>
            <p className="mt-1 truncate text-sm text-ink-600">
              {row.productName}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="Drawer 닫기"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        {/* Sticky section nav — AI / Evidence / Timeline 항상 접근 */}
        <nav
          className="sticky top-0 z-20 flex shrink-0 gap-1 overflow-x-auto border-b border-ink-100 bg-[#fbfaf7]/95 px-3 py-2 backdrop-blur"
          aria-label="Case sections"
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              className={cn(
                'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
                active === s.id
                  ? 'bg-teal-700 text-white'
                  : 'text-ink-600 hover:bg-sand-100',
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section
            ref={(el) => {
              refs.current.overview = el;
            }}
            className="scroll-mt-2 space-y-5"
          >
            <Card>
              <CardContent className="p-4">
                <dl className="grid grid-cols-2 gap-3">
                  <Field label="Case 번호">
                    <span className="font-medium tabular-nums">{row.caseNo}</span>
                  </Field>
                  <Field label="상태">
                    <StatusBadge status={row.status} />
                  </Field>
                  <Field label="담당자">{row.assignee || '미지정'}</Field>
                  <Field label="우선순위">
                    <Badge variant={priorityBadgeVariant(priority)}>
                      {priority}
                    </Badge>
                  </Field>
                  <Field label="마감일">
                    {row.dueDate ? formatTime(row.dueDate) : '미설정'}
                  </Field>
                  <Field label="생성일">{formatTime(row.createdAt)}</Field>
                  <Field label="사이트">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs ${siteTone(
                        row.siteCode,
                      )}`}
                    >
                      {siteLabel(row.siteCode)}
                    </span>
                  </Field>
                </dl>
              </CardContent>
            </Card>

            <InvestigationOrderPanel row={row} />

            <InvestigationWorkflowPanel row={row} />
            <InvestigationAssignmentPanel row={row} />

            <section className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
                매물 정보
              </h3>
              <Card className="overflow-hidden">
                <div className="aspect-[4/3] bg-sand-100">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={row.listingTitle || row.productName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-400">
                      <ImageOff className="h-8 w-8" />
                      <span className="text-xs">이미지 없음</span>
                    </div>
                  )}
                </div>
                <CardContent className="space-y-3 p-4">
                  <Field label="매물 제목">
                    <span className="font-medium text-ink-900">
                      {row.listingTitle || row.productName}
                    </span>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="가격">{formatPrice(row.price)}</Field>
                    <Field label="사이트">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs ${siteTone(
                          row.siteCode,
                        )}`}
                      >
                        {siteLabel(row.siteCode)}
                      </span>
                    </Field>
                  </div>
                  <Field label="등록일">
                    {formatTime(row.listedAt ?? null)}
                  </Field>
                  <Field label="원본 URL">
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-teal-700 underline-offset-2 hover:underline"
                      >
                        {row.url}
                      </a>
                    ) : (
                      '—'
                    )}
                  </Field>
                </CardContent>
              </Card>
            </section>
          </section>

          <Separator />

          <section
            ref={(el) => {
              refs.current.ai = el;
            }}
            className="scroll-mt-2 space-y-5"
          >
            <InvestigationAiPanel row={row} />
            <InvestigationSummaryPanel row={row} />
            <InvestigationRecommendationPanel row={row} />
          </section>

          <Separator />

          <section
            ref={(el) => {
              refs.current.timeline = el;
            }}
            className="scroll-mt-2"
          >
            <InvestigationTimeline events={row.timeline ?? []} />
          </section>

          <Separator />

          <section
            ref={(el) => {
              refs.current.evidence = el;
            }}
            className="scroll-mt-2"
          >
            <InvestigationEvidencePanel row={row} readOnly={locked} />
          </section>

          <Separator />

          <section
            ref={(el) => {
              refs.current.work = el;
            }}
            className="scroll-mt-2 space-y-5"
          >
            <InvestigationNotesPanel row={row} readOnly={locked} />
            <InvestigationFinalDecisionPanel row={row} />
          </section>
        </div>

        <footer className="shrink-0 border-t border-ink-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            {row.url ? (
              <Button
                type="button"
                variant="teal"
                className="flex-1"
                onClick={() =>
                  window.open(row.url!, '_blank', 'noopener,noreferrer')
                }
              >
                원본 보기
                <ExternalLink className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              닫기
            </Button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

/** @deprecated use CaseDrawer */
export const InvestigationDrawer = CaseDrawer;
