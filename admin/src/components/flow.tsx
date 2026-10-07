// The Flow list (Patric, 2026-10-06): the records in flight inside a scope, "Queued at" first
// and sorted by it, the top 100, read again every second while the page is open. One component:
// the Flow page shows it for a tenant and an office, Manual sync shows it for the scope of a run,
// a tenant's page for the tenant. Its figures count every record in the scope, never only the
// rows shown; a record is named by the CRM's id first, its address or name under it (Patric,
// 2026-10-07).
import { useState } from 'react';
import { useCustom } from '@refinedev/core';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Sort } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { capital, entity, exact, number } from '@/lib/format';
import { scopeQuery, type Scope } from '@/lib/scope';

export type FlowState = 'queued' | 'fetched' | 'applied' | 'error';

export type FlowRow = {
  key: string;
  state: FlowState;
  tenantId: number | null;
  tenant: string | null;
  connectionId: string | null;
  officeId: string | null;
  datatype: string | null;
  remoteId: string | null;
  name: string | null;
  queuedAt: string;
  what: string;
};

/** The scope in figures: what waits on the CRMs or failed there (null when unknown), and what Core holds. */
export type FlowTotals = { waiting: number | null; failed: number | null; inCore: number };

export const STATES: Record<
  FlowState,
  { label: string; tone: 'warn' | 'neutral' | 'ok' | 'bad'; row: string }
> = {
  queued: { label: 'waiting for the CRM', tone: 'warn', row: 'flow-queued' },
  fetched: { label: 'in Core', tone: 'neutral', row: 'flow-fetched' },
  applied: { label: 'on a site', tone: 'ok', row: 'flow-applied' },
  error: { label: 'failed', tone: 'bad', row: 'flow-error' },
};

/** How many rows the list holds, and how often it is read again. */
const TOP = 100;
const EVERY_MS = 1_000;

export function FlowList({ scope }: { scope: Scope }) {
  const [sort, setSort] = useState<Sort>({ field: 'queuedAt', order: 'desc' });
  const { result, query } = useCustom<{ rows: FlowRow[]; totals: FlowTotals }>({
    url: '/flow',
    method: 'get',
    config: { query: { ...scopeQuery(scope), limit: String(TOP) } },
    queryOptions: {
      refetchInterval: EVERY_MS,
      refetchIntervalInBackground: false,
      placeholderData: (previous) => previous,
    },
  });
  // Refine hands an empty object until the first answer arrives, so only a list is read as rows.
  const answer = result.data as Partial<{ rows: unknown; totals: FlowTotals }> | undefined;
  const rows = (Array.isArray(answer?.rows) ? [...(answer.rows as FlowRow[])] : []).sort(
    (left, right) => (left.queuedAt < right.queuedAt ? -1 : 1) * (sort.order === 'asc' ? 1 : -1),
  );
  const totals = answer?.totals;

  return (
    <div className="flex flex-col gap-3">
      {totals && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-2" data-testid="flow-counts">
            {totals.waiting !== null && (
              <Badge tone={totals.waiting > 0 ? STATES.queued.tone : 'muted'}>
                {number(totals.waiting)} {STATES.queued.label}
              </Badge>
            )}
            {totals.failed !== null && (
              <Badge tone={totals.failed > 0 ? STATES.error.tone : 'muted'}>
                {number(totals.failed)} failed at the CRM
              </Badge>
            )}
            <Link to={`/records?${new URLSearchParams(scopeQuery(scope)).toString()}`}>
              <Badge tone={STATES.fetched.tone}>
                {number(totals.inCore)} {STATES.fetched.label}
              </Badge>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            The figures count every record, not only those listed below: the records waiting for the
            CRM, those whose last fetch from the CRM failed, and those Core holds. Open “in Core” to
            see them in Records.
          </p>
        </div>
      )}
      <DataTable
        caption={`The newest records on their way, at most ${String(TOP)}, read again every second.`}
        columns={[
          {
            key: 'queuedAt',
            header: 'Queued at',
            sortAs: 'queuedAt',
            cell: (row) => <span className="tabular-nums">{exact(row.queuedAt)}</span>,
          },
          {
            key: 'state',
            header: 'State',
            cell: (row) => <Badge tone={STATES[row.state].tone}>{STATES[row.state].label}</Badge>,
          },
          {
            key: 'tenant',
            header: 'Tenant',
            cell: (row) =>
              row.tenantId === null ? (
                '—'
              ) : (
                <Link className="underline" to={`/tenants/${String(row.tenantId)}`}>
                  {row.tenant ?? `tenant ${String(row.tenantId)}`}
                </Link>
              ),
          },
          {
            key: 'office',
            header: 'Office',
            cell: (row) =>
              row.officeId === null || row.officeId === '' ? (
                '—'
              ) : (
                <Link
                  className="underline"
                  to={`/records?${new URLSearchParams({ ...(row.tenantId === null ? {} : { tenant: String(row.tenantId) }), office: row.officeId }).toString()}`}
                >
                  {row.officeId}
                </Link>
              ),
          },
          {
            key: 'datatype',
            header: 'Entity type',
            cell: (row) => (row.datatype === null ? '—' : capital(entity(row.datatype))),
          },
          {
            key: 'remote',
            header: 'Record',
            cell: (row) =>
              row.connectionId && row.datatype && row.remoteId ? (
                <div className="flex flex-col">
                  <Link
                    className="underline"
                    to={`/records/${encodeURIComponent(row.connectionId)}/${row.datatype}/${encodeURIComponent(row.remoteId)}`}
                  >
                    {row.remoteId}
                  </Link>
                  {row.name !== null && (
                    <span className="text-xs text-muted-foreground">{row.name}</span>
                  )}
                </div>
              ) : (
                '—'
              ),
          },
          { key: 'what', header: 'What happened', cell: (row) => row.what },
        ]}
        rows={rows}
        rowKey={(row) => row.key}
        rowClass={(row) => `${STATES[row.state].row} flow-row`}
        sort={sort}
        onSort={setSort}
        loading={query.isLoading}
        empty={
          <Empty what="No record is on its way for what is picked. When a CRM reports a change, or a manual sync starts, its records show here within a second." />
        }
      />
    </div>
  );
}
