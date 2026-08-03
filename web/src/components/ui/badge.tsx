import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * shadcn/ui Badge — 프로젝트 디자인 토큰(ink/sand/teal)에 맞춤
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-1.5 py-0 text-[10px] font-semibold leading-none tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:ring-offset-1',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-ink-900 text-sand-50 hover:bg-ink-900/90',
        secondary:
          'border-transparent bg-sand-100 text-ink-700 hover:bg-sand-200',
        destructive:
          'border-transparent bg-rose-500 text-white hover:bg-rose-500/90',
        outline: 'border-ink-100 bg-white/80 text-ink-700',
        teal: 'border-transparent bg-teal-700 text-white hover:bg-teal-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** 좌측 6px status dot (currentColor). */
  dot?: boolean;
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), dot && 'gap-1', className)}
      {...props}
    >
      {dot ? (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
          aria-hidden
        />
      ) : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
