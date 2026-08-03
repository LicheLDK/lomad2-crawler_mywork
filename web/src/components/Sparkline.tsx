import { cn } from '../lib/utils';

/** Compact SVG polyline — 12×64px default. Hidden when < 2 points. */
export function MiniSparkline({
  values,
  className,
  width = 64,
  height = 12,
}: {
  values: number[] | undefined | null;
  className?: string;
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('shrink-0 text-teal-600/80', className)}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export type TrendDelta = {
  pct: number;
  direction: 'up' | 'down' | 'flat';
};

/**
 * Day-over-day delta from the last two points of a series
 * (e.g. StatsOverview.searchTrend searches/results).
 */
export function dayOverDayDelta(
  values: number[] | undefined | null,
): TrendDelta | null {
  if (!values || values.length < 2) return null;
  const curr = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? 0;
  if (prev === 0 && curr === 0) {
    return { pct: 0, direction: 'flat' };
  }
  if (prev === 0) {
    return { pct: 100, direction: curr > 0 ? 'up' : 'flat' };
  }
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { pct, direction: 'up' };
  if (pct < 0) return { pct, direction: 'down' };
  return { pct: 0, direction: 'flat' };
}

export function TrendDeltaBadge({ delta }: { delta: TrendDelta | null }) {
  if (!delta) return null;

  const tone =
    delta.direction === 'up'
      ? 'bg-emerald-50 text-emerald-800'
      : delta.direction === 'down'
        ? 'bg-rose-50 text-rose-800'
        : 'bg-ink-50 text-ink-500';

  const arrow =
    delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→';

  const label =
    delta.direction === 'flat'
      ? '보합'
      : `${arrow}${Math.abs(delta.pct)}%`;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
        tone,
      )}
    >
      {label}
    </span>
  );
}
