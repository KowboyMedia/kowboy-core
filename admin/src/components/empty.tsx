import type { ReactNode } from 'react';

/** An empty list says what it would hold and what to do next (§3 I, Must). */
export function Empty({ what, next }: { what: string; next?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <p>{what}</p>
      {next && <div className="flex gap-2">{next}</div>}
    </div>
  );
}
