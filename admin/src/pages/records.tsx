// Records: the figures, a search with server-side filters, sort and pages, a selection to act on,
// and the live activity list: the last records through Core with their state, and what waits on
// the adapters' own lists, coloured by state and lit up as they arrive.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { api, qs } from '@/api/client';
import { providersQuery, recordPath, tenantsQuery } from '@/api/queries';
import type { Activity, ActivityRow, ItemFigures, ItemRow, ItemsPage } from '@/api/types';
import { endOfDay, fmtNumber, startOfDay } from '@/lib/format';
import { PageHeader, Section } from '@/components/page';
import { StatTile, Tiles } from '@/components/stat-tile';
import { DataTable, type Sort } from '@/components/data-table';
import { Moment } from '@/components/moment';
import { YesNo } from '@/components/state-badge';
import { PreviewButton, RefetchButton } from '@/components/actions';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const DATATYPES = ['property', 'agent', 'office', 'area', 'association', 'project'];
const ANY = 'any';
const KEY_SEP = '\u0000';

type Params = { get: (name: string) => string; set: (changes: Record<string, string>) => void };

/** The page's filters live in the address, so a search can be shared and comes back on reload. */
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
      if (!('page' in changes)) next.delete('page');
      setParams(next, { replace: true });
    },
  };
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Choice({
  value,
  onChange,
  options,
  any = 'any',
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  any?: string;
}) {
  return (
    <Select value={value || ANY} onValueChange={onChange}>
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{any}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SearchFilters({ get, set }: Params) {
  const tenants = useQuery(tenantsQuery());
  const providers = useQuery(providersQuery());
  return (
    <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <Filter label="Tenant">
        <Choice
          value={get('tenant')}
          onChange={(value) => set({ tenant: value })}
          options={(tenants.data ?? []).map((tenant) => ({
            value: String(tenant.id),
            label: `#${tenant.id} ${tenant.name}`,
          }))}
        />
      </Filter>
      <Filter label="CRM">
        <Choice
          value={get('provider')}
          onChange={(value) => set({ provider: value })}
          options={(providers.data ?? []).map((provider) => ({
            value: provider.provider,
            label: provider.provider,
          }))}
        />
      </Filter>
      <Filter label="Datatype">
        <Choice
          value={get('datatype')}
          onChange={(value) => set({ datatype: value })}
          options={DATATYPES.map((d) => ({ value: d, label: d }))}
        />
      </Filter>
      <Filter label="Office">
        <Input
          className="h-8"
          value={get('office')}
          onChange={(event) => set({ office: event.target.value })}
          placeholder="office id"
        />
      </Filter>
      <Filter label="Record id">
        <Input
          className="h-8"
          value={get('id')}
          onChange={(event) => set({ id: event.target.value })}
          placeholder="exact id"
        />
      </Filter>
      <Filter label="Written from">
        <Input
          className="h-8"
          type="date"
          value={get('from')}
          onChange={(event) => set({ from: event.target.value })}
        />
      </Filter>
      <Filter label="Written to">
        <Input
          className="h-8"
          type="date"
          value={get('to')}
          onChange={(event) => set({ to: event.target.value })}
        />
      </Filter>
      <Filter label="Removed">
        <Choice
          value={get('removed')}
          onChange={(value) => set({ removed: value })}
          options={[
            { value: 'no', label: 'live only' },
            { value: 'yes', label: 'removed only' },
          ]}
        />
      </Filter>
    </div>
  );
}

const stop = (event: React.MouseEvent): void => event.stopPropagation();

const displayLine = (row: ItemRow): string =>
  Object.values(row.display ?? {})
    .map(String)
    .join(' · ');

const COLUMNS: ColumnDef<ItemRow, unknown>[] = [
  {
    id: 'seq',
    header: 'Seq',
    cell: ({ row }) => <span className="tabular-nums">{row.original.seq}</span>,
  },
  {
    id: 'tenant_id',
    header: 'Tenant',
    cell: ({ row }) => (
      <Link
        to={`/tenants/${row.original.tenant_id}`}
        className="text-primary hover:underline"
        onClick={stop}
      >
        #{row.original.tenant_id}
      </Link>
    ),
  },
  {
    id: 'connection_id',
    header: 'Connection',
    cell: ({ row }) => (
      <span className="font-mono text-xs whitespace-nowrap">{row.original.connection_id}</span>
    ),
  },
  { id: 'datatype', header: 'Datatype', cell: ({ row }) => row.original.datatype },
  {
    id: 'remote_id',
    header: 'Record id',
    cell: ({ row }) => (
      <Link
        to={recordPath(row.original.connection_id, row.original.datatype, row.original.remote_id)}
        className="font-medium text-primary hover:underline"
        onClick={stop}
      >
        {row.original.remote_id}
      </Link>
    ),
  },
  {
    id: 'office_id',
    header: 'Office',
    cell: ({ row }) => row.original.office_id ?? <span className="text-muted-foreground">—</span>,
  },
  {
    id: 'display',
    header: 'Display',
    cell: ({ row }) => (
      <span
        className="block max-w-xs truncate text-muted-foreground"
        title={displayLine(row.original)}
      >
        {displayLine(row.original) || '—'}
      </span>
    ),
  },
  {
    id: 'updated_at',
    header: 'Written',
    cell: ({ row }) => <Moment at={row.original.updated_at} />,
  },
  {
    id: 'remote_updated_at',
    header: 'Changed in the CRM',
    cell: ({ row }) => <Moment at={row.original.remote_updated_at} />,
  },
  {
    id: 'deleted',
    header: 'Removed',
    cell: ({ row }) => <YesNo value={row.original.deleted} yes="removed" no="live" />,
  },
  {
    id: 'rules_version',
    header: 'Rules',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.rules_version}</span>,
  },
  {
    id: 'content_hash',
    header: 'Hash',
    cell: ({ row }) => (
      <span className="font-mono text-xs" title={row.original.content_hash}>
        {row.original.content_hash.slice(0, 10)}
      </span>
    ),
  },
];

function Figures() {
  const figures = useQuery({
    queryKey: ['figures'],
    queryFn: () => api<ItemFigures>('/v1/admin/items/figures'),
    refetchInterval: 30_000,
  });
  const f = figures.data;
  if (!f) return null;
  return (
    <Tiles>
      <StatTile
        label="Live records"
        value={f.live}
        context={`${fmtNumber(f.tombstoned)} removed, kept 90 days`}
      />
      <StatTile
        label={`Written, last ${f.hours} h`}
        value={f.written}
        context={`${fmtNumber(f.unchanged)} unchanged`}
      />
      <StatTile
        label={`Removed, last ${f.hours} h`}
        value={f.removed}
        context="gone from the CRM"
      />
      <StatTile
        label={`Dropped, last ${f.hours} h`}
        value={f.dropped}
        state={f.dropped > 0 ? 'bad' : undefined}
        context="malformed or unlicensed"
      />
      <StatTile
        label={`Applied by sites, last ${f.hours} h`}
        value={f.applied}
        context="records the sites reported applied"
      />
      <StatTile
        label={`Failed on sites, last ${f.hours} h`}
        value={f.failed}
        state={f.failed > 0 ? 'bad' : undefined}
        context="records a site could not apply"
      />
    </Tiles>
  );
}

/** The search box, debounced into the address, and the actions on a selection. */
function Toolbar({
  get,
  set,
  keys,
  onClear,
}: Params & {
  keys: { connectionId: string; datatype: string; remoteId: string }[];
  onClear: () => void;
}) {
  const [text, setText] = useState(get('q'));
  const current = get('q');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (text !== current) set({ q: text });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [text, current, set]);
  return (
    <>
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search words in the record…"
        className="h-8 max-w-xs"
        aria-label="Search words"
      />
      {keys.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1"
          data-testid="selection-bar"
        >
          <span className="text-sm">{keys.length} selected</span>
          <PreviewButton scope={{ keys }} label="Preview recompute" />
          <RefetchButton scope={{ keys }} label="Fetch again" />
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      )}
    </>
  );
}

export function RecordsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { get, set } = params;
  const page = Number(get('page') || 1);
  const size = Number(get('size') || 50);
  const sort: Sort = { by: get('sort') || 'seq', dir: get('dir') === 'asc' ? 'asc' : 'desc' };
  const query = qs({
    tenant: get('tenant'),
    provider: get('provider'),
    datatype: get('datatype'),
    office: get('office'),
    id: get('id'),
    q: get('q'),
    from: get('from') ? startOfDay(get('from')) : '',
    to: get('to') ? endOfDay(get('to')) : '',
    removed: get('removed'),
    sort: sort.by,
    dir: sort.dir,
    page,
    size,
  });
  const items = useQuery({
    queryKey: ['items', query],
    queryFn: () => api<ItemsPage>(`/v1/admin/items${query}`),
    placeholderData: (previous) => previous,
  });
  const [selected, setSelected] = useState<RowSelectionState>({});
  const keys = useMemo(
    () =>
      Object.keys(selected).map((key) => {
        const [connectionId = '', datatype = '', remoteId = ''] = key.split(KEY_SEP);
        return { connectionId, datatype, remoteId };
      }),
    [selected],
  );
  return (
    <>
      <PageHeader
        title="Records"
        intro="Every record Core holds, searchable by any mix of filters; tick rows to recompute them, fetch them again from the CRM, or ring their sites. Below, what is happening to records right now."
      />
      <Figures />
      <Section
        title="Search"
        help="Every filter is applied on the server; sort by any column, and choose the columns you want. The search box looks for words in the unified record."
        className="mb-4"
      >
        <SearchFilters {...params} />
        <DataTable
          columns={COLUMNS}
          rows={items.data?.rows ?? []}
          rowId={(row) => [row.connection_id, row.datatype, row.remote_id].join(KEY_SEP)}
          total={items.data?.total}
          page={page}
          size={size}
          onPage={(nextPage, nextSize) => set({ page: String(nextPage), size: String(nextSize) })}
          sort={sort}
          sortable={items.data?.sortable ?? ['seq']}
          onSort={(next) => set({ sort: next.by, dir: next.dir })}
          selectable
          selected={selected}
          onSelect={setSelected}
          loading={items.isPending}
          rowLink={(row) => navigate(recordPath(row.connection_id, row.datatype, row.remote_id))}
          defaultHidden={['rules_version', 'content_hash', 'remote_updated_at']}
          empty="No record matches these filters."
          toolbar={<Toolbar {...params} keys={keys} onClear={() => setSelected({})} />}
        />
      </Section>
      <ActivityList />
    </>
  );
}

const STATE: Record<
  ActivityRow['state'],
  { row: string; badge: 'warn' | 'info' | 'ok' | 'bad'; label: string }
> = {
  queued: { row: 'bg-warn-soft hover:bg-warn-soft', badge: 'warn', label: 'waiting on the CRM' },
  written: { row: 'bg-info-soft hover:bg-info-soft', badge: 'info', label: 'fetched and written' },
  applied: { row: 'bg-ok-soft hover:bg-ok-soft', badge: 'ok', label: 'applied by a site' },
  error: { row: 'bg-bad-soft hover:bg-bad-soft', badge: 'bad', label: 'failed' },
};

/** The record cell: a link to the record's page once it is written, the bare id while it waits. */
function RecordCell({ row }: { row: ActivityRow }) {
  const { connection_id: connection, datatype, remote_id: remoteId } = row;
  if (!connection || !datatype || !remoteId || row.state === 'queued')
    return <TableCell>{remoteId}</TableCell>;
  return (
    <TableCell>
      <Link
        to={recordPath(connection, datatype, remoteId)}
        className="text-primary hover:underline"
      >
        {remoteId}
      </Link>
    </TableCell>
  );
}

function TenantCell({ tenantId }: { tenantId: number | null }) {
  if (tenantId === null)
    return (
      <TableCell>
        <span className="text-muted-foreground">—</span>
      </TableCell>
    );
  return (
    <TableCell>
      <Link to={`/tenants/${tenantId}`} className="text-primary hover:underline">
        #{tenantId}
      </Link>
    </TableCell>
  );
}

function ChainCell({ id }: { id: string | null }) {
  if (!id) return <TableCell className="pr-5" />;
  return (
    <TableCell className="pr-5">
      <Link
        to={`/events?correlation=${encodeURIComponent(id)}`}
        className="font-mono text-xs text-primary hover:underline"
        title={id}
      >
        {id.slice(0, 8)}
      </Link>
    </TableCell>
  );
}

function ActivityRowView({ row, fresh }: { row: ActivityRow; fresh: boolean }) {
  const state = STATE[row.state];
  const detail = row.error ?? row.detail ?? '';
  return (
    <TableRow data-state-name={row.state} className={cn(state.row, fresh && 'row-in')}>
      <TableCell className="pl-5">
        <Moment at={row.at} />
      </TableCell>
      <TableCell>
        <Badge variant={state.badge}>{state.label}</Badge>
      </TableCell>
      <TableCell>
        {row.what}
        {row.attempts ? (
          <span className="text-xs text-muted-foreground"> · attempt {row.attempts}</span>
        ) : null}
      </TableCell>
      <TenantCell tenantId={row.tenant_id} />
      <TableCell className="font-mono text-xs whitespace-nowrap">
        {row.connection_id ?? row.provider ?? '—'}
      </TableCell>
      <TableCell>{row.office_id ?? '—'}</TableCell>
      <TableCell>{row.datatype}</TableCell>
      <RecordCell row={row} />
      <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={detail}>
        {detail}
      </TableCell>
      <TableCell className="text-xs">
        <SiteOutcome site={row.site} />
      </TableCell>
      <ChainCell id={row.correlation_id} />
    </TableRow>
  );
}

function SiteOutcome({ site }: { site: ActivityRow['site'] }) {
  if (!site) return null;
  return (
    <span className={site.result === 'failed' ? 'text-bad' : 'text-ok'}>
      {site.result}
      {site.client ? ` · ${site.client}` : ''}
      {site.detail ? `: ${site.detail}` : ''}
    </span>
  );
}

function ActivityList() {
  const activity = useQuery({
    queryKey: ['activity'],
    queryFn: () => api<Activity>('/v1/admin/items/activity'),
    refetchInterval: 5_000,
  });
  const seen = useRef<Set<string> | null>(null);
  const rows = useMemo(() => {
    const all = [...(activity.data?.queued ?? []), ...(activity.data?.rows ?? [])];
    return all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 200);
  }, [activity.data]);
  const fresh = new Set<string>();
  if (seen.current) for (const row of rows) if (!seen.current.has(row.key)) fresh.add(row.key);
  useEffect(() => {
    seen.current = new Set(rows.map((row) => row.key));
  }, [rows]);
  const count = (state: ActivityRow['state']): number =>
    rows.filter((row) => row.state === state).length;
  return (
    <Section
      title="Live activity"
      help="The last 100 records through Core and what still waits on the adapters’ fetch lists, newest first, the whole row coloured by state. It updates as things happen."
      flush
      actions={
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="warn">{count('queued')} waiting</Badge>
          <Badge variant="info">{count('written')} written</Badge>
          <Badge variant="ok">{count('applied')} applied</Badge>
          <Badge variant="bad">{count('error')} failed</Badge>
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="px-5 text-sm text-muted-foreground">
          Nothing has moved yet. Records show here as adapters fetch them and sites apply them.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">When</TableHead>
              <TableHead>State</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Datatype</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="pr-5">Chain</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ActivityRowView key={row.key} row={row} fresh={fresh.has(row.key)} />
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
