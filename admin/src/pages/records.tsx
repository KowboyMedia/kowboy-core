// Records (Patric, 2026-10-06, built from zero): everything Core holds, live and removed, newest
// change first, narrowed by the same scope as Manual sync (tenants, offices, entity types, one
// record id), in pages of 500. Every choice is in the address, so a view is a link. Only what
// Patric named stays (2026-10-07): no sorting, no columns to pick, no rows-a-page box. A record
// is named as in the record list on a tenant's page: the CRM's id first, its entity type and
// address or name under it, and its office by the CRM's id alone.
import { Link, useSearchParams } from 'react-router';
import { useList } from '@refinedev/core';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { ScopePicker, useScopeOptions } from '@/components/scope-picker';
import { capital, counted, entity, moment } from '@/lib/format';
import { isEverything, readScope, scopeQuery, tenantName, writeScope } from '@/lib/scope';

/** Core sends Records in pages of this many (RECORDS_PAGE in engine/storage/items.ts). */
const PAGE_SIZE = 500;

export type RecordRow = {
  tenantId: number;
  connectionId: string;
  /** The connection by the name a person gave it; its id is for addresses only. */
  connectionName: string;
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

export function Records() {
  const [params, setParams] = useSearchParams();
  const options = useScopeOptions();
  const scope = readScope(params);
  const page = Number(params.get('page') ?? 1);

  const { result, query } = useList<RecordRow>({
    resource: 'records',
    pagination: { currentPage: page, pageSize: PAGE_SIZE },
    filters: Object.entries(scopeQuery(scope)).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    })),
  });
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Records"
        what="Every record Core holds, the one changed last first. A live record is on the sites; a removed one left the CRM’s list, and Core keeps it 90 days. Pick tenants, offices, entity types or one record to see fewer; a box left empty takes all of its kind. Open a record to see what the CRM sent, what Core made of it and what happened to it."
      />

      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ScopePicker
              value={scope}
              onChange={(next) => {
                // A new scope starts from the first page again.
                const changed = writeScope(params, next);
                changed.delete('page');
                setParams(changed, { replace: true });
              }}
              options={options}
            />
          </div>
        </CardContent>
      </Card>

      <DataTable
        caption={counted(total, 'record', 'records')}
        columns={[
          {
            key: 'what',
            header: 'What it is',
            cell: (row) => (
              <div className="flex flex-col">
                <Link className="font-medium hover:underline" to={recordPath(row)}>
                  {row.remoteId}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {[capital(entity(row.datatype)), row.addressLine ?? row.name]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            ),
          },
          {
            key: 'tenant',
            header: 'Tenant',
            cell: (row) => (
              <Link className="underline" to={`/tenants/${String(row.tenantId)}`}>
                {tenantName(options, row.tenantId)}
              </Link>
            ),
          },
          {
            key: 'office',
            header: 'Office',
            cell: (row) =>
              row.officeId === null ? (
                '—'
              ) : (
                <Link
                  className="underline"
                  to={`/records?tenant=${String(row.tenantId)}&office=${encodeURIComponent(row.officeId)}`}
                >
                  {row.officeId}
                </Link>
              ),
          },
          {
            key: 'deleted',
            header: 'State',
            cell: (row) => (
              <Badge tone={row.deleted ? 'muted' : 'ok'}>{row.deleted ? 'removed' : 'live'}</Badge>
            ),
          },
          {
            key: 'updatedAt',
            header: 'Changed in Core',
            cell: (row) => <span className="tabular-nums">{moment(row.updatedAt)}</span>,
          },
        ]}
        rows={rows}
        rowKey={(row) => `${row.connectionId}|${row.datatype}|${row.remoteId}`}
        loading={query.isLoading}
        page={{
          page,
          size: PAGE_SIZE,
          total,
          onPage: (next) => {
            const changed = new URLSearchParams(params);
            changed.set('page', String(next));
            setParams(changed, { replace: true });
          },
        }}
        empty={
          <Empty
            what={
              !isEverything(scope)
                ? 'No record matches what is picked. Empty a box to see more.'
                : 'Core holds no records yet. Records arrive when a tenant’s CRM connection has fetched them.'
            }
          />
        }
      />
    </>
  );
}
