import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  FolderPlus,
  Link2,
  ListChecks,
  NotebookPen,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { formatTime } from '../../../../lib/format';
import type {
  InvestigationTimelineEvent,
  TimelineEventKind,
} from '../../types';
import { Badge } from '../../../../components/ui/badge';
import {
  Timeline,
  TimelineContent,
  TimelineDescription,
  TimelineDot,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '../../../../components/ui/timeline';

const EVENT_META: Record<
  TimelineEventKind,
  {
    label: string;
    tone: 'default' | 'teal' | 'amber' | 'rose' | 'emerald' | 'sky';
    Icon: typeof Search;
  }
> = {
  search_run: { label: '검색', tone: 'sky', Icon: Search },
  ai_analysis: { label: 'AI', tone: 'amber', Icon: Bot },
  investigation_created: {
    label: '생성',
    tone: 'teal',
    Icon: FolderPlus,
  },
  ai_rule_warning: {
    label: 'Rule',
    tone: 'rose',
    Icon: AlertTriangle,
  },
  order_mapped: { label: '주문', tone: 'sky', Icon: Link2 },
  investigation_summary: {
    label: 'Summary',
    tone: 'amber',
    Icon: Sparkles,
  },
  judgment_reasons: {
    label: '근거',
    tone: 'amber',
    Icon: ListChecks,
  },
  ai_recommendation: {
    label: '추천',
    tone: 'emerald',
    Icon: Sparkles,
  },
  assignee_set: { label: '담당', tone: 'sky', Icon: UserPlus },
  note_added: { label: '메모', tone: 'default', Icon: NotebookPen },
  status_changed: {
    label: '상태',
    tone: 'amber',
    Icon: ClipboardList,
  },
  evidence_saved: {
    label: 'Evidence',
    tone: 'teal',
    Icon: FileSearch,
  },
  final_decision: {
    label: '판정',
    tone: 'emerald',
    Icon: CheckCircle2,
  },
  completed: { label: '완료', tone: 'emerald', Icon: CheckCircle2 },
};

function eventMeta(kind: string | undefined) {
  if (kind && kind in EVENT_META) {
    return EVENT_META[kind as TimelineEventKind];
  }
  return {
    label: '기타',
    tone: 'teal' as const,
    Icon: ShieldCheck,
  };
}

export function InvestigationTimeline({
  events,
}: {
  events: InvestigationTimelineEvent[];
}) {
  /** chronological: oldest → newest */
  const list = [...events].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
          Timeline
        </h3>
        <Badge variant="secondary">{list.length}</Badge>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-6 text-center text-sm text-ink-400">
          타임라인 기록이 없습니다.
        </div>
      ) : (
        <Timeline>
          {list.map((ev, idx) => {
            const meta = eventMeta(ev.kind);
            const Icon = meta.Icon;
            const isLast = idx === list.length - 1;
            return (
              <TimelineItem key={ev.id} showLine={!isLast}>
                <TimelineDot tone={meta.tone}>
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </TimelineDot>
                <TimelineContent>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TimelineTitle>{ev.title}</TimelineTitle>
                    <Badge variant="outline">{meta.label}</Badge>
                  </div>
                  {ev.detail ? (
                    <TimelineDescription>{ev.detail}</TimelineDescription>
                  ) : null}
                  <TimelineTime dateTime={ev.at}>
                    {formatTime(ev.at)}
                  </TimelineTime>
                </TimelineContent>
              </TimelineItem>
            );
          })}
        </Timeline>
      )}
    </section>
  );
}
