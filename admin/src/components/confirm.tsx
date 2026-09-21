import { useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Anything that removes, rotates a secret or starts a run that changes many records is red and
 * asks first, with a sentence saying what will happen (Patric's rule 2). One component, so the
 * question always looks the same.
 */
export function Confirm({
  label,
  title,
  what,
  confirmLabel,
  onConfirm,
  variant = 'danger',
  size,
  children,
  disabled,
}: {
  label: ReactNode;
  title: string;
  /** What will happen, in a sentence a person can act on. */
  what: string;
  confirmLabel?: string;
  onConfirm: () => Promise<unknown> | unknown;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  children?: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size={size} disabled={disabled}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{what}</DialogDescription>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Keep it as it is
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={variant}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Working…' : (confirmLabel ?? 'Yes, do it')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
