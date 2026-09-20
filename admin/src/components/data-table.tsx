// A table with sort, pages, a column chooser and a selection, the same everywhere. Sorting and
// paging are the server's: the table only says what it wants.
import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type Header,
  type Row,
  type RowSelectionState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fmtNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type Sort = { by: string; dir: 'asc' | 'desc' };

export type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  rows: T[];
  rowId: (row: T) => string;
  total?: number;
  page?: number;
  size?: number;
  sizes?: number[];
  onPage?: (page: number, size: number) => void;
  sort?: Sort;
  sortable?: string[];
  onSort?: (sort: Sort) => void;
  selectable?: boolean;
  selected?: RowSelectionState;
  onSelect?: (selected: RowSelectionState) => void;
  rowClass?: (row: T) => string | undefined;
  rowLink?: (row: T) => void;
  empty?: string;
  loading?: boolean;
  toolbar?: React.ReactNode;
  defaultHidden?: string[];
};

const SIZES = [25, 50, 100, 200, 500];

function selectColumn<T>(): ColumnDef<T, unknown> {
  return {
    id: 'select',
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
        aria-label="Select every row on this page"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(value === true)}
        aria-label="Select this row"
        onClick={(event) => event.stopPropagation()}
      />
    ),
  };
}

function ColumnChooser<T>({ columns }: { columns: Column<T, unknown>[] }) {
  if (columns.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto" aria-label="Choose columns">
          <Columns3Icon /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Shown columns</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(value)}
            onSelect={(event) => event.preventDefault()}
          >
            {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeaderCell<T>({
  header,
  sort,
  sortable,
  onSort,
}: {
  header: Header<T, unknown>;
  sort?: Sort;
  sortable: string[];
  onSort?: (sort: Sort) => void;
}) {
  const id = header.column.id;
  const content = flexRender(header.column.columnDef.header, header.getContext());
  if (!sortable.includes(id) || !onSort) return <TableHead>{content}</TableHead>;
  const active = sort?.by === id;
  const dir = sort?.dir ?? 'desc';
  return (
    <TableHead>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          active && 'text-foreground',
        )}
        onClick={() => onSort({ by: id, dir: active && dir === 'desc' ? 'asc' : 'desc' })}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {content}
        {active &&
          (dir === 'asc' ? (
            <ArrowUpIcon className="size-3" />
          ) : (
            <ArrowDownIcon className="size-3" />
          ))}
      </button>
    </TableHead>
  );
}

function Pagination({
  total,
  page,
  size,
  sizes,
  selectedCount,
  onPage,
}: {
  total: number;
  page: number;
  size: number;
  sizes: number[];
  selectedCount: number;
  onPage: (page: number, size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {fmtNumber(total)} in all{selectedCount > 0 && `, ${selectedCount} selected`}
      </span>
      <div className="flex items-center gap-2">
        <Select value={String(size)} onValueChange={(value) => onPage(1, Number(value))}>
          <SelectTrigger size="sm" className="w-28" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular-nums">
          page {page} of {pages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1, size)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1, size)}
          aria-label="Next page"
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

function Rows<T>({
  rows,
  columnCount,
  empty,
  rowClass,
  rowLink,
}: {
  rows: Row<T>[];
  columnCount: number;
  empty: string;
  rowClass?: (row: T) => string | undefined;
  rowLink?: (row: T) => void;
}) {
  if (rows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={columnCount} className="h-20 text-center text-muted-foreground">
          {empty}
        </TableCell>
      </TableRow>
    );
  }
  return rows.map((row) => (
    <TableRow
      key={row.id}
      data-state={row.getIsSelected() ? 'selected' : undefined}
      data-row={row.id}
      className={cn(rowLink && 'cursor-pointer', rowClass?.(row.original))}
      onClick={rowLink ? () => rowLink(row.original) : undefined}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  ));
}

type Settled<T> = Required<
  Pick<
    DataTableProps<T>,
    | 'selectable'
    | 'selected'
    | 'sortable'
    | 'loading'
    | 'sizes'
    | 'page'
    | 'size'
    | 'empty'
    | 'defaultHidden'
  >
> &
  DataTableProps<T>;

/** The props with their defaults filled in, so the table itself has nothing to decide. */
const settle = <T,>(props: DataTableProps<T>): Settled<T> => ({
  selectable: false,
  selected: {},
  sortable: [],
  loading: false,
  sizes: SIZES,
  page: 1,
  size: 50,
  empty: 'Nothing matches.',
  defaultHidden: [],
  ...props,
});

export function DataTable<T>(given: DataTableProps<T>) {
  const props = settle(given);
  const [visibility, setVisibility] = useState<VisibilityState>(
    Object.fromEntries(props.defaultHidden.map((id) => [id, false])),
  );
  const all = props.selectable ? [selectColumn<T>(), ...props.columns] : props.columns;
  const table = useReactTable({
    data: props.rows,
    columns: all,
    getCoreRowModel: getCoreRowModel(),
    getRowId: props.rowId,
    manualSorting: true,
    manualPagination: true,
    enableRowSelection: props.selectable,
    onRowSelectionChange: (updater) =>
      props.onSelect?.(typeof updater === 'function' ? updater(props.selected) : updater),
    onColumnVisibilityChange: setVisibility,
    state: { rowSelection: props.selected, columnVisibility: visibility },
  });
  const onPage = props.onPage;
  const total = props.total;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {props.toolbar}
        <ColumnChooser
          columns={table.getAllLeafColumns().filter((column) => column.getCanHide())}
        />
      </div>
      <div
        className={cn('rounded-md border', props.loading && 'opacity-60')}
        aria-busy={props.loading}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <HeaderCell
                    key={header.id}
                    header={header}
                    sort={props.sort}
                    sortable={props.sortable}
                    onSort={props.onSort}
                  />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <Rows
              rows={table.getRowModel().rows}
              columnCount={all.length}
              empty={props.loading ? 'Loading…' : props.empty}
              rowClass={props.rowClass}
              rowLink={props.rowLink}
            />
          </TableBody>
        </Table>
      </div>
      {onPage && total !== undefined && (
        <Pagination
          total={total}
          page={props.page}
          size={props.size}
          sizes={props.sizes}
          selectedCount={Object.keys(props.selected).length}
          onPage={onPage}
        />
      )}
    </div>
  );
}
