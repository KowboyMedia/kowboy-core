// Events (U3, U6): the whole log with its filters, newest first, tailing live. Who did what on
// the panel is not a second page — it is the `admin.` filter (docs/admin-panel-design.md §2).
import { Link, useSearchParams } from 'react-router';
import { useList } from '@refinedev/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { moment } from '@/lib/format';
import { recordPath } from './records';

type EventRow = {
  id: number;
  at: string;
  type: string;
  correlationId: string | null;
  tenantId: number | null;
  connectionId: string | null;
  datatype: string | null;
  remoteId: string | null;
  subscriberId: number | null;
  fields: Record<string, unknown>;
};

const FILTERS = [
  { key: 'type', label: 'Type', placeholder: 'entity.written' },
  { key: 'tenant', label: 'Tenant number', placeholder: '1' },
  { key: 'connection', label: 'Connection', placeholder: 'acme-crm' },
  { key: 'site', label: 'Site number', placeholder: '1' },
  { key: 'correlation', label: 'Chain', placeholder: 'a correlation id' },
  { key: 'from', label: 'From', placeholder: '2026-09-20T00:00:00Z' },
  { key: 'to', label: 'To', placeholder: '2026-09-21T00:00:00Z' },
] as const;

/** The types worth one click, so nobody has to remember how they are spelled. */
const SHORTCUTS = [
  { type: '', label: 'Everything' },
  { type: 'admin.tenant_saved', label: 'Saves' },
  { type: 'admin.signed_in', label: 'Sign-ins' },
  { type: 'entity.written', label: 'Records written' },
  { type: 'entity.dropped', label: 'Records dropped' },
  { type: 'bell', label: 'Bells' },
  { type: 'pull', label: 'Pulls' },
  { type: 'site.failed', label: 'A site could not apply' },
  { type: 'alert.sent', label: 'Alerts' },
];

export function Events() {
  const [params, setParams] = useSearchParams();

  const set = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value === '') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const { result, query } = useList<EventRow>({
    resource: 'events',
    pagination: { mode: 'off' },
    filters: FILTERS.map((filter) => ({
      field: filter.key,
      operator: 'eq' as const,
      value: params.get(filter.key) ?? '',
    })),
  });
  const rows = result?.data ?? [];

  return (
    <>
      <PageHeader
        title="Events"
        what="Everything that happened, newest first, updating as it happens. Follow a chain to see one notification all the way to a site."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 pt-4">
          <div className="flex flex-wrap gap-2">
            {SHORTCUTS.map((shortcut) => (
              <Button
                key={shortcut.label}
                size="sm"
                variant={(params.get('type') ?? '') === shortcut.type ? 'default' : 'outline'}
                onClick={() => set('type', shortcut.type)}
              >
                {shortcut.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FILTERS.map((filter) => (
              <div key={filter.key} className="flex flex-col gap-1">
                <Label htmlFor={`event-${filter.key}`}>{filter.label}</Label>
                <Input
                  id={`event-${filter.key}`}
                  value={params.get(filter.key) ?? ''}
                  placeholder={filter.placeholder}
                  onChange={(event) => set(filter.key, event.target.value)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <DataTable
        caption={`${rows.length} event(s)`}
        columns={[
          {
            key: 'at',
            header: 'When',
            cell: (event) => <span className="tabular-nums">{moment(event.at)}</span>,
          },
          {
            key: 'type',
            header: 'What',
            cell: (event) => (
              <button type="button" onClick={() => set('type', event.type)}>
                <Badge tone={event.type.startsWith('admin.') ? 'warn' : 'neutral'}>
                  {event.type}
                </Badge>
              </button>
            ),
          },
          {
            key: 'tenant',
            header: 'Tenant',
            cell: (event) =>
              event.tenantId === null ? (
                '—'
              ) : (
                <Link className="underline" to={`/tenants/${String(event.tenantId)}`}>
                  {event.tenantId}
                </Link>
              ),
          },
          {
            key: 'record',
            header: 'Record',
            cell: (event) =>
              event.connectionId && event.datatype && event.remoteId ? (
                <Link
                  className="font-mono text-xs underline"
                  to={recordPath({
                    connectionId: event.connectionId,
                    datatype: event.datatype,
                    remoteId: event.remoteId,
                  })}
                >
                  {event.datatype} {event.remoteId}
                </Link>
              ) : (
                '—'
              ),
          },
          {
            key: 'fields',
            header: 'Detail',
            cell: (event) => (
              <code className="text-xs break-all">{JSON.stringify(event.fields)}</code>
            ),
          },
          {
            key: 'chain',
            header: 'Chain',
            cell: (event) =>
              event.correlationId ? (
                <button
                  type="button"
                  className="font-mono text-xs underline"
                  onClick={() => set('correlation', event.correlationId ?? '')}
                >
                  follow
                </button>
              ) : (
                '—'
              ),
          },
        ]}
        rows={rows}
        rowKey={(event) => String(event.id)}
        loading={query.isLoading}
        empty={
          <Empty
            what={
              params.size === 0
                ? 'The log is empty. Everything Core does appears here as it happens.'
                : 'No event matches these filters.'
            }
            next={
              params.size > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setParams(new URLSearchParams())}
                >
                  Clear the filters
                </Button>
              ) : undefined
            }
          />
        }
      />
    </>
  );
}
