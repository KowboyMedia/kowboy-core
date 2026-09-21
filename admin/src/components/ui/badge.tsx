import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badge = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-secondary text-secondary-foreground',
        ok: 'border-transparent bg-ok/15 text-ok',
        warn: 'border-transparent bg-warn/20 text-warn',
        bad: 'border-transparent bg-danger/15 text-danger',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badge>;

export const Badge = ({ className, tone, ...props }: BadgeProps) => (
  <span className={cn(badge({ tone }), className)} {...props} />
);
