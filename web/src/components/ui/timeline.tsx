import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui 스타일 Timeline — 프로젝트 디자인 토큰(ink/sand/teal)에 맞춤
 */
const Timeline = React.forwardRef<
  HTMLOListElement,
  React.HTMLAttributes<HTMLOListElement>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      'relative space-y-0 rounded-xl border border-ink-100 bg-white px-4 py-3',
      className,
    )}
    {...props}
  />
));
Timeline.displayName = 'Timeline';

const TimelineItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement> & { showLine?: boolean }
>(({ className, showLine = true, children, ...props }, ref) => (
  <li
    ref={ref}
    className={cn('relative flex gap-3 pb-4 last:pb-1', className)}
    {...props}
  >
    {showLine ? (
      <span
        className="absolute bottom-0 left-[15px] top-8 w-px bg-ink-100 last:hidden"
        aria-hidden
      />
    ) : null}
    {children}
  </li>
));
TimelineItem.displayName = 'TimelineItem';

const TimelineDot = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    tone?: 'default' | 'teal' | 'amber' | 'rose' | 'emerald' | 'sky';
  }
>(({ className, tone = 'teal', children, ...props }, ref) => {
  const toneClass =
    {
      default: 'bg-ink-400 text-white',
      teal: 'bg-teal-700 text-white',
      amber: 'bg-amber-500 text-white',
      rose: 'bg-rose-500 text-white',
      emerald: 'bg-emerald-600 text-white',
      sky: 'bg-sky-600 text-white',
    }[tone] ?? 'bg-teal-700 text-white';

  return (
    <span
      ref={ref}
      className={cn(
        'relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
        toneClass,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
});
TimelineDot.displayName = 'TimelineDot';

const TimelineContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('min-w-0 flex-1 pt-0.5', className)} {...props} />
));
TimelineContent.displayName = 'TimelineContent';

const TimelineTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm font-medium text-ink-900', className)}
    {...props}
  />
));
TimelineTitle.displayName = 'TimelineTitle';

const TimelineDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('mt-0.5 text-xs leading-relaxed text-ink-500', className)}
    {...props}
  />
));
TimelineDescription.displayName = 'TimelineDescription';

const TimelineTime = React.forwardRef<
  HTMLTimeElement,
  React.TimeHTMLAttributes<HTMLTimeElement>
>(({ className, ...props }, ref) => (
  <time
    ref={ref}
    className={cn('mt-1 block text-[11px] tabular-nums text-ink-400', className)}
    {...props}
  />
));
TimelineTime.displayName = 'TimelineTime';

export {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineContent,
  TimelineTitle,
  TimelineDescription,
  TimelineTime,
};
