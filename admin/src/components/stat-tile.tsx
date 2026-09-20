// A figure with its label and one line of context, coloured by state. The sparkline is the last
// hours, oldest first, drawn thin.
import { fmtNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type TileState = 'ok' | 'bad' | 'warn' | undefined;

export function StatTile({
  label,
  value,
  context,
  state,
  spark,
}: {
  label: string;
  value: string | number;
  context?: string;
  state?: TileState;
  spark?: number[];
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs" data-tile={label}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div
          className={cn(
            'text-2xl font-semibold tabular-nums tracking-tight',
            state === 'bad' && 'text-bad',
            state === 'warn' && 'text-warn',
            state === 'ok' && 'text-ok',
          )}
        >
          {typeof value === 'number' ? fmtNumber(value) : value}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} />}
      </div>
      {context && <div className="text-xs text-muted-foreground">{context}</div>}
    </div>
  );
}

export function Sparkline({
  values,
  width = 96,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, values.length - 1);
  const points = values.map(
    (value, index) =>
      `${(index * step).toFixed(1)},${(height - 2 - (value / max) * (height - 4)).toFixed(1)}`,
  );
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0 text-series-1"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(' ')}
      />
    </svg>
  );
}

export function Tiles({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{children}</div>
  );
}
