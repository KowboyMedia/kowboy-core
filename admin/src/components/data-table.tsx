// The one list in the app (§3 I: one pattern each for a list, a detail page, a form and a row's
// actions). Every column is declared once and the table does the rest: sorting by a header where
// a page offers it, Back and Next where a list comes in pages, a loading state and an empty state
// that says what to do next. Every column is always shown: the column chooser went with
// Patric's word of 2026-10-07 ("The columns goes also, for all views").
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { number } from '@/lib/format';

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** The column is sortable by this name. */
  sortAs?: string;
  className?: string;
};

export type Sort = { field: string; order: 'asc' | 'desc' };

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Shown instead of an empty table: what this list is, and what to do next. */
  empty?: ReactNode;
  sort?: Sort;
  onSort?: (sort: Sort) => void;
  page?: {
    page: number;
    size: number;
    total: number;
    onPage: (page: number) => void;
  };
  /** A class for the whole row, which is how the Flow list colours by state. */
  rowClass?: (row: T) => string | undefined;
  caption?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  sort,
  onSort,
  page,
  rowClass,
  caption,
}: DataTableProps<T>) {
  // What the pager and the column names do when pressed, said once under the table.
  const how = [
    page && 'Back and Next show the page before or after this one.',
    onSort &&
      columns.some((column) => column.sortAs) &&
      'Press a column’s name to sort by it, and again to turn the order round.',
  ]
    .filter(Boolean)
    .join(' ');
  const headerButton = (column: Column<T>): ReactNode => {
    if (!column.sortAs || !onSort) return column.header;
    const active = sort?.field === column.sortAs;
    const Icon = !active ? ChevronsUpDown : sort?.order === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        aria-label={`Sort by ${column.header}`}
        onClick={() =>
          onSort({
            field: column.sortAs ?? '',
            order: active && sort?.order === 'desc' ? 'asc' : 'desc',
          })
        }
      >
        {column.header}
        <Icon className="size-3" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {headerButton(column)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10">
                  <div className="text-center text-sm text-muted-foreground">{empty}</div>
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={rowKey(row)} className={rowClass?.(row)}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {page && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {page.total === 0
              ? 'Nothing to show'
              : `${number((page.page - 1) * page.size + 1)} to ${number(Math.min(page.page * page.size, page.total))} of ${number(page.total)}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page.page <= 1}
              onClick={() => page.onPage(page.page - 1)}
            >
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page.page * page.size >= page.total}
              onClick={() => page.onPage(page.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {how !== '' && <p className="text-xs text-muted-foreground">{how}</p>}
    </div>
  );
}
