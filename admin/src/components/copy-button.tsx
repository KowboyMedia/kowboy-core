import { useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Copies a value to the clipboard and says so. */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      toast.success('Copied');
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error('The browser refused to copy; select the text and copy it yourself.');
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('gap-1.5', className)}
      onClick={() => void copy()}
      aria-label={label}
    >
      {done ? <CheckIcon className="text-ok" /> : <CopyIcon />}
      {done ? 'Copied' : label}
    </Button>
  );
}

/** A secret or token: shown in full, selectable in one click, with a copy button. */
export function Secret({ value, label }: { value: string; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded bg-muted px-2 py-1 text-xs break-all select-all">{value}</code>
      <CopyButton value={value} label={label ?? 'Copy'} />
    </div>
  );
}
