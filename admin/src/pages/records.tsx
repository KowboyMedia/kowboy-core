// Records (Patric, 2026-10-06, built from zero): everything Core holds, narrowed by the same
// scope as Manual sync (tenants, offices, entity types, one record id), live, removed or both,
// sorted by any column, in pages. Every choice is in the address, so a view is a link; a row
// opens the record.
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useList } from '@refinedev/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/input';
import { DataTable, DEFAULT_PAGE_SIZE, type Sort } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { ScopePicker, useScopeOptions } from '@/components/scope-picker';
import { capital, counted, crmName, entity, moment } from '@/lib/format';
import {
  isEverything,
  officeLabel,
  readScope,
  scopeQuery,
  tenantName,
  writeScope,
} from '@/lib/scope';

export type RecordRow = {
  tenantId: number;
  connectionId: string;
  provider: string;
  datatype: string;
  remoteId: string;
  officeId: string | null;
  seq: number;
  deleted: boolean;
  updatedAt: string;
  remoteUpdatedAt: string | null;
  rulesVersion: string;
  schemaVersion: string;
  name: string | null;
  addressLine: string | null;
};

export const recordPath = (row: {
  connectionId: string;
  datatype: string;
  remoteId: string;
}): string =>
  `/records/${encodeURIComponent(row.connectionId)}/${row.datatype}/${encodeURIComponent(row.remoteId)}`;

/** Live, removed or both, as the address says it. */
const SHOWN = [
  { value: 'false', label: 'Live' },
  { value: 'true', label: 'Removed' },
  { value: '', label: 'Both' },
] as const;

export function Records() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const options = useScopeOptions();
  const scope = readScope(params);
  const deleted = params.get('deleted') ?? '';
  const page = Number(params.get('page') ?? 1);
  const size = Number(params.get('size') ?? DEFAULT_PAGE_SIZE);
  const sort: Sort = {
    field: params.get('sort') ?? 'updated_at',
    order: params.get('dir') === 'asc' ? 'asc' : 'desc',
  };

  /** A change of anything but the page starts from the first page again. */
  const change = (next: URLSearchParams, samePage = false): void => {
    if (!samePage) next.delete('page');
    setParams(next, { replace: true });
  };
  const set = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value === '') next.delete(key);
    else next.set(key, value);
    change(next, key === 'page');
  };

  const { result, query } = useList<RecordRow>({
    resource: 'records',
    pagination: { currentPage: page, pageSize: size },
    sorters: [{ field: sort.field, order: sort.order }],
    filters: Object.entries({ ...scopeQuery(scope), deleted }).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    })),
  });
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;
  const narrowed = !isEverything(scope) || deleted !== '';

  return (
    <>
      <PageHeader
        title="Records"
        what="Every record Core holds. Pick tenants, offices, entity types or one record to see fewer; a box left empty takes all of its kind. Open a record to see what the CRM sent, what Core made of it and what happened to it."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ScopePicker
              value={scope}
              onChange={(next) => change(writeScope(params, next))}
              options={options}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label id="shown-label">Show</Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" role="group" aria-labelledby="shown-label">
                {SHOWN.map((one) => (
                  <Button
                    key={one.label}
                    size="sm"
                    variant={deleted === one.value ? 'default' : 'outline'}
                    aria-pressed={deleted === one.value}
                    onClick={() => set('deleted', one.value)}
                  >
                    {one.label}
                  </Button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                Live records are on the sites. Removed records left the CRM’s list and are kept 90
                days.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        caption={counted(total, 'record', 'records')}
        columns={[
          {
            key: 'what',
            header: 'What it is',
            sortAs: 'remote_id',
            cell: (row) => (
              <div className="flex flex-col">
                <Link className="font-medium hover:underline" to={recordPath(row)}>
                  {row.addressLine ?? row.name ?? row.remoteId}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {capital(entity(row.datatype))}, CRM id {row.remoteId}
                </span>
              </div>
            ),
          },
          {
            key: 'tenant',
            header: 'Tenant',
            sortAs: 'tenant_id',
            cell: (row) => (
              <Link className="underline" to={`/tenants/${String(row.tenantId)}`}>
                {tenantName(options, row.tenantId)}
              </Link>
            ),
          },
          {
            key: 'office',
            header: 'Office',
            sortAs: 'office_id',
            cell: (row) =>
              row.officeId === null ? (
                '—'
              ) : (
                <Link
                  className="underline"
                  to={`/records?tenant=${String(row.tenantId)}&office=${encodeURIComponent(row.officeId)}`}
                >
                  {officeLabel(options, row.officeId, row.tenantId)}
                </Link>
              ),
          },
          {
            key: 'deleted',
            header: 'State',
            sortAs: 'deleted',
            cell: (row) => (
              <Badge tone={row.deleted ? 'muted' : 'ok'}>{row.deleted ? 'removed' : 'live'}</Badge>
            ),
          },
          {
            key: 'updatedAt',
            header: 'Changed in Core',
            sortAs: 'updated_at',
            cell: (row) => <span className="tabular-nums">{moment(row.updatedAt)}</span>,
          },
          {
            key: 'remoteUpdatedAt',
            header: 'Changed in the CRM',
            sortAs: 'remote_updated_at',
            cell: (row) => <span className="tabular-nums">{moment(row.remoteUpdatedAt)}</span>,
            optional: true,
          },
          {
            key: 'connection',
            header: 'CRM connection',
            sortAs: 'connection_id',
            cell: (row) => (
              <Link
                className="underline"
                to={`/tenants/${String(row.tenantId)}#connection:${row.connectionId}`}
              >
                {crmName(row.provider)}, short name {row.connectionId}
              </Link>
            ),
            optional: true,
          },
        ]}
        rows={rows}
        rowKey={(row) => `${row.connectionId}|${row.datatype}|${row.remoteId}`}
        onRowClick={(row) => void navigate(recordPath(row))}
        loading={query.isLoading}
        sort={sort}
        onSort={(next) => {
          const next_ = new URLSearchParams(params);
          next_.set('sort', next.field);
          next_.set('dir', next.order);
          change(next_);
        }}
        page={{
          page,
          size,
          total,
          onPage: (next) => set('page', String(next)),
          onSize: (next) => set('size', String(next)),
        }}
        empty={
          <Empty
            what={
              narrowed
                ? 'No record matches what is picked. Empty a box to see more.'
                : 'Core holds no records yet. Records arrive when a tenant’s CRM connection has fetched them.'
            }
          />
        }
      />
    </>
  );
}
