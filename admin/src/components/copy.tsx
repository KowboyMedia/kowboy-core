import { useState } from 'react';
import { Check, Copy as CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A secret shown in full with one button that copies it and says "copied" (§3 A, Must). Stripe's
 * pattern: the value lives on the page, not in a one-time dialog nobody can go back to.
 */
export function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2 py-1 font-mono text-xs">
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Copy the ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            // A browser that refuses the clipboard still shows the value to select by hand.
          }
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? <Check aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        {done ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
