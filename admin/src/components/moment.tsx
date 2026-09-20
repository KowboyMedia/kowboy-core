import { fmtAgo, fmtMoment, fmtUtc } from '@/lib/format';

/** A time in Swedish time, the UTC moment on hover; nothing when there is none. */
export function Moment({
  at,
  ago = false,
  empty = '—',
}: {
  at: string | Date | null | undefined;
  ago?: boolean;
  empty?: string;
}) {
  if (!at) return <span className="text-muted-foreground">{empty}</span>;
  const iso = new Date(at).toISOString();
  return (
    <time dateTime={iso} title={fmtUtc(at)} className="tabular-nums whitespace-nowrap">
      {ago ? fmtAgo(at) : fmtMoment(at)}
    </time>
  );
}
