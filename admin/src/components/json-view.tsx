import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** A payload as it is, foldable, with one button to copy the whole thing. */
export function JsonView({ value, rows = 24 }: { value: unknown; rows?: number }) {
  const [wrapped, setWrapped] = useState(true);
  const text = JSON.stringify(value ?? null, null, 2);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setWrapped((on) => !on)}>
          {wrapped ? 'Do not wrap' : 'Wrap lines'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void navigator.clipboard?.writeText(text).catch(() => undefined)}
        >
          Copy
        </Button>
      </div>
      <pre
        className="overflow-auto rounded-md border bg-muted p-3 font-mono text-xs"
        style={{ maxHeight: `${rows * 1.15}rem`, whiteSpace: wrapped ? 'pre-wrap' : 'pre' }}
      >
        {text}
      </pre>
    </div>
  );
}
