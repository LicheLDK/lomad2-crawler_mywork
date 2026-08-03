import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Skeleton primitive — shimmer placeholder matching card/tile geometry.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md bg-[length:200%_100%] bg-[linear-gradient(90deg,#e0d8cc_0%,#efeae2_45%,#e0d8cc_90%)]',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
