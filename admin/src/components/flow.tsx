// The Flow list (Patric, 2026-10-06): the records in flight inside a scope, "Queued at" first
// and sorted by it, the top 100, read again every second while the page is open. One component:
// the Flow page shows it for a tenant and an office, Manual sync shows it for the scope of a run.
import { useState } from 'react';
import { useCustom } from '@refinedev/core';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Sort } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { capital, counted, entity, exact } from '@/lib/format';
import { officeLabel, scopeQuery, type Scope, type ScopeOptions } from '@/lib/scope';

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

export function FlowList({ scope, options }: { scope: Scope; options: ScopeOptions }) {
  const [sort, setSort] = useState<Sort>({ field: 'queuedAt', order: 'desc' });
  const { result, query } = useCustom<{ data: FlowRow[] }>({
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
  const answer: unknown = result.data;
  const rows = (Array.isArray(answer) ? [...(answer as FlowRow[])] : []).sort(
    (left, right) => (left.queuedAt < right.queuedAt ? -1 : 1) * (sort.order === 'asc' ? 1 : -1),
  );
  const counts = new Map<FlowState, number>();
  for (const row of rows) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" data-testid="flow-counts">
        {(Object.keys(STATES) as FlowState[]).map((state) => (
          <Badge key={state} tone={STATES[state].tone}>
            {counts.get(state) ?? 0} {STATES[state].label}
          </Badge>
        ))}
      </div>
      <DataTable
        caption={`${counted(rows.length, 'record', 'records')} on the way, the newest ${String(TOP)} at most. The list is read again every second.`}
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
              row.officeId === null ? (
                '—'
              ) : (
                <Link
                  className="underline"
                  to={`/records?${new URLSearchParams({ ...(row.tenantId === null ? {} : { tenant: String(row.tenantId) }), office: row.officeId }).toString()}`}
                >
                  {officeLabel(options, row.officeId, row.tenantId)}
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
                    {row.name ?? `CRM id ${row.remoteId}`}
                  </Link>
                  {row.name !== null && (
                    <span className="text-xs text-muted-foreground">CRM id {row.remoteId}</span>
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
