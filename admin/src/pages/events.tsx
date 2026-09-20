// The event log: the timeline query with filters, pages, a live tail, following a chain by its
// correlation id, and the audit trail of who did what on the panel.
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, qs } from '@/api/client';
import { tenantsQuery } from '@/api/queries';
import type { EventsPage } from '@/api/types';
import { PageHeader, Section } from '@/components/page';
import { EventTable } from '@/components/event-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ANY = 'any';
const FILTERS = ['tenant', 'connection', 'type', 'correlation', 'entity', 'from', 'to', 'audit'];

/** A typed time as the moment it names; anything else goes as typed, so the API can say what is wrong with it. */
const moment = (value: string): string =>
  value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : value;

type Params = {
  get: (name: string) => string;
  set: (changes: Record<string, string>) => void;
  clear: () => void;
};

function useParams(): Params {
  const [params, setParams] = useSearchParams();
  return {
    get: (name) => params.get(name) ?? '',
    set: (changes) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value === '' || value === ANY) next.delete(key);
        else next.set(key, value);
      }
      if (!('before' in changes)) next.delete('before');
      setParams(next, { replace: true });
    },
    clear: () => setParams({}, { replace: true }),
  };
}

function Field({
  label,
  name,
  get,
  set,
  type = 'text',
  placeholder,
  disabled,
}: Params & {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="h-8"
        type={type}
        value={get(name)}
        disabled={disabled}
        onChange={(event) => set({ [name]: event.target.value })}
        placeholder={placeholder}
      />
    </div>
  );
}

function Filters(params: Params & { audit: boolean; problems: string[] }) {
  const tenants = useQuery(tenantsQuery());
  const { get, set, audit, problems } = params;
  return (
    <Section
      title="Filters"
      help="A value that is not what it should be is left out and named here. The newest page refreshes itself; older pages stay put."
      className="mb-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Tenant</Label>
          <Select value={get('tenant') || ANY} onValueChange={(value) => set({ tenant: value })}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>any</SelectItem>
              {(tenants.data ?? []).map((tenant) => (
                <SelectItem key={tenant.id} value={String(tenant.id)}>
                  #{tenant.id} {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field {...params} label="Connection" name="connection" placeholder="any" />
        {audit ? (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Input className="h-8" value="admin.action" disabled />
          </div>
        ) : (
          <Field {...params} label="Type" name="type" placeholder="entity.written, bell, pull…" />
        )}
        <Field {...params} label="Correlation id" name="correlation" placeholder="a chain" />
        <Field {...params} label="Record" name="entity" placeholder="connection/datatype/id" />
        <Field {...params} label="From" name="from" type="datetime-local" />
        <Field {...params} label="To" name="to" type="datetime-local" />
      </div>
      {problems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" role="status">
          {problems.map((problem) => (
            <Badge key={problem} variant="warn">
              {problem}
            </Badge>
          ))}
        </div>
      )}
    </Section>
  );
}

/** The query string the page's filters make. */
const queryFor = (get: Params['get'], audit: boolean): string =>
  qs({
    tenant: get('tenant'),
    connection: get('connection'),
    type: audit ? 'admin.action' : get('type'),
    correlation: get('correlation'),
    entity: get('entity'),
    from: moment(get('from')),
    to: moment(get('to')),
    before: get('before'),
    limit: 100,
    order: 'desc',
  });

function EventsList({
  params,
  page,
  loading,
}: {
  params: Params;
  page: EventsPage | undefined;
  loading: boolean;
}) {
  const { get, set } = params;
  const before = get('before');
  const next = page?.next;
  return (
    <Section
      title={before ? 'Older events' : 'Newest events'}
      help={
        before
          ? `Events before #${before}.`
          : 'The 100 newest events that match; new ones appear as they happen.'
      }
      flush
      actions={
        <>
          {before && (
            <Button variant="outline" size="sm" onClick={() => set({ before: '' })}>
              Newest
            </Button>
          )}
          {next && (
            <Button variant="outline" size="sm" onClick={() => set({ before: String(next) })}>
              Older
            </Button>
          )}
        </>
      }
    >
      <EventTable
        events={page?.events ?? []}
        empty={loading ? 'Loading…' : 'No events match.'}
        onCorrelation={(correlation) => set({ correlation })}
      />
    </Section>
  );
}

export function EventsPage() {
  const params = useParams();
  const { get, set, clear } = params;
  const audit = get('audit') === '1';
  const query = queryFor(get, audit);
  const events = useQuery({
    queryKey: ['events', query],
    queryFn: () => api<EventsPage>(`/v1/admin/events${query}`),
    placeholderData: (previous) => previous,
    refetchInterval: get('before') ? false : 10_000,
  });
  const filtersOn = FILTERS.some((key) => get(key));
  return (
    <>
      <PageHeader
        title="Events"
        intro="Everything Core and its adapters did, newest first. Filter by tenant, connection, type, a record or a time range; follow a chain from the CRM’s notification to the sites by its correlation id; the audit trail is who did what on the panel."
        actions={
          <>
            <Button
              variant={audit ? 'default' : 'outline'}
              size="sm"
              onClick={() => set({ audit: audit ? '' : '1', type: '' })}
            >
              {audit ? 'Showing the audit trail' : 'Audit trail'}
            </Button>
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear filters
              </Button>
            )}
          </>
        }
      />
      <Filters {...params} audit={audit} problems={events.data?.problems ?? []} />
      <EventsList params={params} page={events.data} loading={events.isPending} />
    </>
  );
}
