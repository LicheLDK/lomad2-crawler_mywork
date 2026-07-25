import {
  Bot,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  FolderPlus,
  NotebookPen,
  Search,
  ShieldCheck,
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
  search_run: { label: '??', tone: 'sky', Icon: Search },
  ai_analysis: { label: 'AI', tone: 'amber', Icon: Bot },
  investigation_created: {
    label: '??',
    tone: 'teal',
    Icon: FolderPlus,
  },
  assignee_set: { label: '??', tone: 'sky', Icon: UserPlus },
  note_added: { label: '??', tone: 'default', Icon: NotebookPen },
  status_changed: {
    label: '??',
    tone: 'amber',
    Icon: ClipboardList,
  },
  evidence_saved: {
    label: 'Evidence',
    tone: 'teal',
    Icon: FileSearch,
  },
  final_decision: {
    label: '??',
    tone: 'emerald',
    Icon: CheckCircle2,
  },
  completed: { label: '??', tone: 'emerald', Icon: CheckCircle2 },
};

function eventMeta(kind: TimelineEventKind | undefined) {
  if (kind && EVENT_META[kind]) return EVENT_META[kind];
  return {
    label: '???',
    tone: 'teal' as const,
    Icon: ShieldCheck,
  };
}

export function InvestigationTimeline({
  events,
}: {
  events: InvestigationTimelineEvent[];
}) {
  /** chronological: oldest ? newest */
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
          ???? ???? ????.
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
