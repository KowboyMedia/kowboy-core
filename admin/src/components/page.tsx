// The frame of every page: a title, one line on what it is for, the actions that belong to it,
// and the cards below, each saying what it shows or does.
import type { ReactNode } from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  intro,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-xs font-medium text-muted-foreground uppercase">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  help,
  actions,
  children,
  className,
  flush = false,
}: {
  title: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Tables sit flush with the card's edges. */
  flush?: boolean;
}) {
  return (
    <Card
      className={cn('gap-3', className)}
      data-section={typeof title === 'string' ? title : undefined}
    >
      <CardHeader className="flex-row flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          {help && <CardDescription className="mt-1">{help}</CardDescription>}
        </div>
        {actions && <CardAction className="flex flex-wrap gap-2">{actions}</CardAction>}
      </CardHeader>
      <CardContent className={flush ? 'px-0 [&_table]:text-sm' : undefined}>{children}</CardContent>
    </Card>
  );
}

export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 md:grid-cols-2', className)}>{children}</div>;
}
