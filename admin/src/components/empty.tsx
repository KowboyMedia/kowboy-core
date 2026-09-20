import type { ReactNode } from 'react';

/** An empty state that says what to do next. */
export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="max-w-md text-sm text-muted-foreground">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
