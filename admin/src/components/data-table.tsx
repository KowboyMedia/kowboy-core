// The one list in the app (§3 I: one pattern each for a list, a detail page, a form and a row's
// actions). Every column is declared once and the table does the rest: sorting by a header, ticking
// rows, choosing which columns are shown, paging, a loading state and an empty state that says what
// to do next. Sorting, filtering and paging are the server's, so nothing here holds a second copy
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
  /** Ticking rows is on only when the page says what to do with them. */
  selected?: Set<string>;
  onSelect?: (selected: Set<string>) => void;
  /** Shown above the table when at least one row is ticked. */
  selectionActions?: ReactNode;
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

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  sort,
  onSort,
  selected,
  onSelect,
  selectionActions,
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
  const ticking = selected !== undefined && onSelect !== undefined;
  const allTicked = ticking && rows.length > 0 && rows.every((row) => selected.has(rowKey(row)));

  const toggleAll = (): void => {
    if (!ticking) return;
    const next = new Set(selected);
    for (const row of rows) {
      if (allTicked) next.delete(rowKey(row));
      else next.add(rowKey(row));
    }
    onSelect(next);
  };

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
          {ticking && selected.size > 0 ? (
            <>
              <span>{selected.size} ticked</span>
              <Button variant="ghost" size="sm" onClick={() => onSelect(new Set())}>
                Clear
              </Button>
              {selectionActions}
            </>
          ) : (
            <span>{caption}</span>
          )}
        </div>
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setChooser((open) => !open)}>
            <Columns3 aria-hidden="true" /> Columns
          </Button>
          {chooser && (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border bg-card p-2 shadow-lg">
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
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {ticking && (
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    aria-label="Tick every row on this page"
                    checked={allTicked}
                    onChange={toggleAll}
                  />
                </TableHead>
              )}
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
                  colSpan={shown.length + (ticking ? 1 : 0)}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={shown.length + (ticking ? 1 : 0)} className="py-10">
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
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {ticking && (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Tick ${key}`}
                        checked={selected.has(key)}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          onSelect(next);
                        }}
                      />
                    </TableCell>
                  )}
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
              : `${(page.page - 1) * page.size + 1}–${Math.min(page.page * page.size, page.total)} of ${page.total}`}
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
    </div>
  );
}
