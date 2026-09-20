// Flow (U5, Patric's rule 3): one list of the records in flight, sorted by the time they were
// queued, the whole row coloured by state, tailed live and animating as rows arrive and change.
import { useList } from '@refinedev/core';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { moment } from '@/lib/format';

type FlowState = 'queued' | 'fetched' | 'applied' | 'error';

type FlowRow = {
  key: string;
  state: FlowState;
  tenantId: number | null;
  tenant: string | null;
  connectionId: string | null;
  officeId: string | null;
  datatype: string | null;
  remoteId: string | null;
  queuedAt: string;
  what: string;
  attempt: number | null;
  site: string | null;
};

const STATES: Record<
  FlowState,
  { label: string; tone: 'warn' | 'neutral' | 'ok' | 'bad'; row: string }
> = {
  queued: { label: 'waiting for the CRM', tone: 'warn', row: 'flow-queued' },
  fetched: { label: 'in Core', tone: 'neutral', row: 'flow-fetched' },
  applied: { label: 'on a site', tone: 'ok', row: 'flow-applied' },
  error: { label: 'error', tone: 'bad', row: 'flow-error' },
};

export function Flow() {
  // A list resource, so Refine's live mode refreshes it from the stream without a reload.
  const { result, query } = useList<FlowRow>({
    resource: 'flow',
    pagination: { mode: 'off' },
  });
  const rows = result?.data ?? [];
  const counts = new Map<FlowState, number>();
  for (const row of rows) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Flow"
        what="Every record on its way through Core, newest first. The page follows along by itself."
      >
        {(Object.keys(STATES) as FlowState[]).map((state) => (
          <Badge key={state} tone={STATES[state].tone}>
            {counts.get(state) ?? 0} {STATES[state].label}
          </Badge>
        ))}
      </PageHeader>

      <Card>
        <CardContent className="pt-4">
          <DataTable
            caption={`${rows.length} record(s) in flight`}
            columns={[
              {
                key: 'state',
                header: 'State',
                cell: (row) => (
                  <Badge tone={STATES[row.state].tone}>{STATES[row.state].label}</Badge>
                ),
              },
              { key: 'tenant', header: 'Tenant', cell: (row) => row.tenant ?? '—' },
              { key: 'office', header: 'Office', cell: (row) => row.officeId ?? '—' },
              { key: 'datatype', header: 'Entity', cell: (row) => row.datatype ?? '—' },
              {
                key: 'remote',
                header: 'Record',
                cell: (row) =>
                  row.connectionId && row.datatype && row.remoteId ? (
                    <Link
                      className="font-mono text-xs underline"
                      to={`/records/${encodeURIComponent(row.connectionId)}/${row.datatype}/${encodeURIComponent(row.remoteId)}`}
                    >
                      {row.remoteId}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'queuedAt',
                header: 'Queued at',
                cell: (row) => <span className="tabular-nums">{moment(row.queuedAt)}</span>,
              },
              { key: 'what', header: 'What happened', cell: (row) => row.what },
              {
                key: 'attempt',
                header: 'Attempt',
                cell: (row) => (row.attempt === null ? '—' : row.attempt),
              },
              {
                key: 'site',
                header: 'The site said',
                cell: (row) => row.site ?? '—',
                optional: true,
              },
            ]}
            rows={rows}
            rowKey={(row) => row.key}
            rowClass={(row) => `${STATES[row.state].row} flow-row`}
            loading={query.isLoading}
            empty={
              <Empty what="Nothing is in flight. When a CRM sends something, it appears here as it happens." />
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
