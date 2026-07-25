import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-ink-900 text-sand-50 hover:bg-ink-800',
        teal: 'bg-teal-700 text-white hover:bg-teal-600',
        outline:
          'border border-ink-200 bg-white text-ink-700 hover:bg-sand-50',
        ghost: 'text-ink-600 hover:bg-sand-100 hover:text-ink-900',
        danger: 'bg-rose-600 text-white hover:bg-rose-500',
      },
      size: {
        default: 'px-3.5 py-2',
        sm: 'rounded-lg px-2.5 py-1.5 text-xs',
        lg: 'px-4 py-2.5',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
