import * as React from 'react';
import { cn } from '../../lib/utils';

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('block text-xs text-ink-400', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
