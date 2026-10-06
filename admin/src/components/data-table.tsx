// The one list in the app (§3 I: one pattern each for a list, a detail page, a form and a row's
// actions). Every column is declared once and the table does the rest: sorting by a header,
// choosing which columns are shown, paging, a loading state and an empty state that says what to
// do next. Sorting, filtering and paging are the server's, so nothing here holds a second copy
// of the data.
import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listed, number } from '@/lib/format';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** The column is sortable by this name on the server. */
  sortAs?: string;
  /** Off until a person turns it on in the column chooser. */
  optional?: boolean;
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
    onSize: (size: number) => void;
  };
  /** A class for the whole row, which is how the Flow list colours by state. */
  rowClass?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  caption?: string;
};

const SIZES = [25, 50, 100, 250, 500];

/** The grid shows this many rows unless a person picks otherwise (Patric, 2026-09-21). */
export const DEFAULT_PAGE_SIZE = 500;

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
  onRowClick,
  caption,
}: DataTableProps<T>) {
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((column) => column.optional).map((column) => column.key)),
  );
  const [chooser, setChooser] = useState(false);
  const shown = columns.filter((column) => !hidden.has(column.key));
  // The chooser exists for the columns that start hidden; a table without any has no button.
  const optional = columns
    .filter((column) => column.optional)
    .map((column) => `“${column.header}”`);
  // What the pager and the column names do when pressed, said once under the table.
  const how = [
    page && 'Back and Next turn the page, and the box beside them sets how many rows a page shows.',
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{caption}</span>
        </div>
        {optional.length > 0 && (
          <div className="relative flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Picks which columns show. {listed(optional, optional.length)}{' '}
              {optional.length === 1 ? 'is' : 'are'} hidden at first.
            </span>
            <Button variant="outline" size="sm" onClick={() => setChooser((open) => !open)}>
              <Columns3 aria-hidden="true" /> Columns
            </Button>
            {chooser && (
              <div className="absolute top-full right-0 z-20 mt-1 w-56 rounded-md border bg-card p-2 shadow-lg">
                {columns.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={!hidden.has(column.key)}
                      onChange={() => {
                        const next = new Set(hidden);
                        if (next.has(column.key)) next.delete(column.key);
                        else next.add(column.key);
                        setHidden(next);
                      }}
                    />
                    {column.header}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {shown.map((column) => (
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
                  colSpan={shown.length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={shown.length} className="py-10">
                  <div className="text-center text-sm text-muted-foreground">{empty}</div>
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <TableRow
                  key={key}
                  className={cn(rowClass?.(row), onRowClick && 'cursor-pointer')}
                  onClick={
                    onRowClick
                      ? (event) => {
                          // A link or a button in the row does its own thing, once.
                          if ((event.target as HTMLElement).closest('a, button, input')) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                >
                  {shown.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
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
            <Select
              className="h-8 w-28"
              aria-label="Rows a page"
              value={page.size}
              onChange={(event) => page.onSize(Number(event.target.value))}
            >
              {SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} a page
                </option>
              ))}
            </Select>
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
