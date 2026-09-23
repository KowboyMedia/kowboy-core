// The day's chart, in its own file so the charting library is fetched only when the Overview page
// is open, and the rest of the app stays a small download.
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
import { hour, moment } from '@/lib/format';
import { SERIES } from '@/lib/series';

export default function DayChart({
  hours,
}: {
  hours: ({ hour: string } & Record<string, number>)[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={hours}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="hour" tickFormatter={hour} fontSize={11} tickLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip labelFormatter={(value) => moment(typeof value === 'string' ? value : null)} />
        <Legend />
        {SERIES.map((series) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.label}
            stackId="a"
            fill={series.fill}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
