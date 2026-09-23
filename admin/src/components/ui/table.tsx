import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export const TableHeader = (props: ComponentProps<'thead'>) => (
  <thead className="[&_tr]:border-b" {...props} />
);
export const TableBody = (props: ComponentProps<'tbody'>) => (
  <tbody className="[&_tr:last-child]:border-0" {...props} />
);
export const TableRow = ({ className, ...props }: ComponentProps<'tr'>) => (
  <tr className={cn('border-b transition-colors hover:bg-muted/60', className)} {...props} />
);
export const TableHead = ({ className, ...props }: ComponentProps<'th'>) => (
  <th
    className={cn(
      'h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground',
      className,
    )}
    {...props}
  />
);
export const TableCell = ({ className, ...props }: ComponentProps<'td'>) => (
  <td className={cn('px-3 py-2 align-middle', className)} {...props} />
);
