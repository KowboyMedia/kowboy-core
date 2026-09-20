// How the app writes a moment, a number and a duration, in one place, so every page says it the
// same way. The panel is in English (§3 I, "the panel in Swedish" is a Won't).

const NEVER = '—';

export function moment(value: string | null | undefined): string {
  if (!value) return NEVER;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return NEVER;
  return at.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

/** "4 minutes ago", for the things a person judges by how fresh they are. */
export function ago(value: string | null | undefined): string {
  if (!value) return 'never';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return 'never';
  if (seconds < 60) return `${Math.max(seconds, 0)} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86_400)} days ago`;
}

export const count = (value: number | null | undefined): string =>
  value === null || value === undefined ? NEVER : value.toLocaleString('en-GB');

/** The hour label on the day's chart. */
export const hour = (value: string): string => new Date(value).toISOString().slice(11, 13) + ':00';
