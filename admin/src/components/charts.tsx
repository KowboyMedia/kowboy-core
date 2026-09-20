// The charts: stacked columns per hour with a legend, hover readouts and a table twin (the
// dataviz rules: thin marks, a 2px gap between fills, one axis, colours validated for colour
// vision, red only for what failed); bars per category; a meter for a share.
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtHour, fmtNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** The series colours in fixed order, and red for what failed. */
export const SERIES = ['#066fd1', '#f76707', '#0ca678', '#ae3ec9'] as const;
export const BAD = '#d63939';

export type Series = { key: string; label: string; values: number[]; colour?: string };

export function HourlyChart({
  hours,
  series,
  caption,
}: {
  hours: string[];
  series: Series[];
  caption: string;
}) {
  const [table, setTable] = useState(false);
  const data: Record<string, string | number>[] = hours.map((hour, index) => ({
    hour: fmtHour(hour),
    ...Object.fromEntries(series.map((s) => [s.key, s.values[index] ?? 0])),
  }));
  const total = series.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0);
  return (
    <figure className="flex flex-col gap-2" data-chart={caption}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{total === 0 ? 'Nothing in this window yet.' : `${fmtNumber(total)} in all`}</span>
        <Button variant="ghost" size="sm" onClick={() => setTable((was) => !was)}>
          {table ? 'Chart' : 'Table'}
        </Button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hour</TableHead>
                {series.map((s) => (
                  <TableHead key={s.key} className="text-right">
                    {s.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={String(row['hour'])}>
                  <TableCell className="tabular-nums">{String(row['hour'])}</TableCell>
                  {series.map((s) => (
                    <TableCell key={s.key} className="text-right tabular-nums">
                      {fmtNumber(Number(row[s.key] ?? 0))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="h-56 w-full" role="img" aria-label={caption}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: -12 }}
              barCategoryGap={2}
            >
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="2 4" />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                interval={3}
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-muted)' }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontSize: 12,
                }}
                formatter={(value) => fmtNumber(Number(value))}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              {series.map((s, index) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="all"
                  fill={s.colour ?? SERIES[index % SERIES.length]}
                  stroke="var(--color-card)"
                  strokeWidth={1}
                  radius={index === series.length - 1 ? [3, 3, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

/** Horizontal bars for a few categories, direct-labelled. */
export function Bars({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="flex flex-col gap-2" data-chart="bars">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{row.label}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-series-1"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          <span className="tabular-nums">
            {fmtNumber(row.value)}
            {row.note && <span className="ml-2 text-xs text-muted-foreground">{row.note}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A share of a whole, coloured by whether it is what it should be. */
export function Meter({
  value,
  of,
  state,
  label,
}: {
  value: number;
  of: number;
  state: 'ok' | 'bad' | 'warn' | undefined;
  label: string;
}) {
  const share = of === 0 ? 0 : Math.round((value / of) * 100);
  return (
    <div
      className="flex flex-col gap-1"
      role="meter"
      aria-valuenow={share}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-2xl font-semibold tabular-nums">
          {value} of {of}
        </span>
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full',
            state === 'bad' ? 'bg-bad' : state === 'warn' ? 'bg-warn' : 'bg-ok',
          )}
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}
