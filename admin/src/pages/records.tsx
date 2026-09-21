// Records (U3): the grid. Every filter, the sort, the page and the page size live in the address,
// so a filtered view is a link one can paste to a colleague (React-admin's pattern, read
// 2026-09-20). The tenant, the connection, the office and the entity are picked from the same
// component Manual sync uses, never typed (Patric, 2026-09-21).
//
// Ticking acts on records. "Select all" means every record the search matches, not the page in
// front of you: when it is on, the actions send the search itself as the scope, so a hundred
// thousand matches cost the same as fifty.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useCustomMutation, useList } from '@refinedev/core';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Confirm } from '@/components/confirm';
import { DataTable, DEFAULT_PAGE_SIZE, type Sort } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { ScopePicker, useScopeOptions, type ScopeValue } from '@/components/scope-picker';
import { count, moment } from '@/lib/format';

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
  contentHash: string;
  rulesVersion: string;
  schemaVersion: string;
  name: string | null;
  addressLine: string | null;
};

/** The boxes a person types into. The pickers above them cover tenant, connection, office, entity. */
const TYPED = [
  { key: 'q', label: 'Words in the record', placeholder: 'storgatan' },
  { key: 'id', label: 'Record id', placeholder: 'OBJ-1' },
  { key: 'from', label: 'Written from', placeholder: '2026-09-01' },
  { key: 'to', label: 'Written before', placeholder: '2026-09-21' },
] as const;

/** Every filter the grid can hold, so clearing and counting never miss one. */
const FILTER_KEYS = [
  'q',
  'id',
  'from',
  'to',
  'tenant',
  'connection',
  'office',
  'datatype',
  'deleted',
];

export const recordPath = (row: {
  connectionId: string;
  datatype: string;
  remoteId: string;
}): string =>
  `/records/${encodeURIComponent(row.connectionId)}/${row.datatype}/${encodeURIComponent(row.remoteId)}`;

export function Records() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** On: the actions mean every record the search matches, not the ones loaded. */
  const [allMatching, setAllMatching] = useState(false);
  const options = useScopeOptions();
  const { mutateAsync } = useCustomMutation();

  const set = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
    setSelected(new Set());
    setAllMatching(false);
  };

  const scope: ScopeValue = {
    tenantId: params.get('tenant') ?? '',
    connectionId: params.get('connection') ?? '',
    officeId: params.get('office') ?? '',
    datatype: params.get('datatype') ?? '',
  };

  const setScope = (next: ScopeValue): void => {
    const params_ = new URLSearchParams(params);
    for (const [key, value] of [
      ['tenant', next.tenantId],
      ['connection', next.connectionId],
      ['office', next.officeId],
      ['datatype', next.datatype],
    ] as const) {
      if (value === undefined || value === '') params_.delete(key);
      else params_.set(key, value);
    }
    params_.delete('page');
    setParams(params_, { replace: true });
    setSelected(new Set());
    setAllMatching(false);
  };

  const page = Number(params.get('page') ?? 1);
  const size = Number(params.get('size') ?? DEFAULT_PAGE_SIZE);
  const sort: Sort = {
    field: params.get('sort') ?? 'seq',
    order: params.get('dir') === 'asc' ? 'asc' : 'desc',
  };

  const { result, query } = useList<RecordRow>({
    resource: 'records',
    pagination: { currentPage: page, pageSize: size },
    sorters: [{ field: sort.field, order: sort.order }],
    filters: FILTER_KEYS.map((key) => ({
      field: key,
      operator: 'eq' as const,
      value: params.get(key) ?? '',
    })),
  });
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;

  const keyOf = (row: RecordRow): string => `${row.connectionId}|${row.datatype}|${row.remoteId}`;
  const chosen = rows.filter((row) => selected.has(keyOf(row)));
  const howMany = allMatching ? total : chosen.length;

  /**
   * What the actions act on. With "select all" on, that is the search itself — the same filters
   * the server just counted — so nothing depends on which page happens to be loaded.
   */
  const target = (): Record<string, unknown> => {
    if (!allMatching) {
      return {
        records: chosen.map((row) => ({
          connectionId: row.connectionId,
          datatype: row.datatype,
          remoteId: row.remoteId,
        })),
      };
    }
    const out: Record<string, unknown> = {};
    if (params.get('tenant')) out['tenantId'] = Number(params.get('tenant'));
    if (params.get('connection')) out['connectionId'] = params.get('connection');
    if (params.get('office')) out['officeId'] = params.get('office');
    if (params.get('datatype')) out['datatype'] = params.get('datatype');
    if (params.get('id')) out['remoteId'] = params.get('id');
    if (params.get('q')) out['text'] = params.get('q');
    return out;
  };

  const run = async (url: string, fallback: string): Promise<void> => {
    try {
      const answer = await mutateAsync({
        url,
        method: 'post',
        values: target(),
        successNotification: false,
        errorNotification: false,
      });
      const detail = (answer.data as unknown as { detail?: string })?.detail;
      toast.success(detail ?? fallback);
      setSelected(new Set());
      setAllMatching(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const ringTheirSites = async (): Promise<void> => {
    const tenants = allMatching
      ? [Number(params.get('tenant') ?? 0)].filter(Boolean)
      : [...new Set(chosen.map((row) => row.tenantId))];
    if (tenants.length === 0) {
      toast.error('Choose a tenant first, or tick rows, so Core knows whose sites to ring.');
      return;
    }
    for (const tenantId of tenants) {
      await mutateAsync({
        url: `/tenants/${String(tenantId)}/ring`,
        method: 'post',
        values: {},
        successNotification: false,
        errorNotification: false,
      });
    }
    toast.success(`Rang the sites of ${String(tenants.length)} tenant(s).`);
  };

  const filtered = FILTER_KEYS.some((key) => params.get(key));

  return (
    <>
      <PageHeader
        title="Records"
        what="Everything Core holds. Narrow it down, sort it, tick what you need and act on it."
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <ScopePicker value={scope} onChange={setScope} options={options} />
          {TYPED.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-1">
              <Label htmlFor={`filter-${filter.key}`}>{filter.label}</Label>
              <Input
                id={`filter-${filter.key}`}
                value={params.get(filter.key) ?? ''}
                placeholder={filter.placeholder}
                onChange={(event) => set(filter.key, event.target.value)}
              />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <Label htmlFor="filter-deleted">Removed</Label>
            <Select
              id="filter-deleted"
              value={params.get('deleted') ?? ''}
              onChange={(event) => set('deleted', event.target.value)}
            >
              <option value="">live and removed</option>
              <option value="false">live only</option>
              <option value="true">removed only</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              disabled={!filtered}
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
            >
              Clear the filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        caption={`${count(total)} record(s) match`}
        columns={[
          {
            key: 'what',
            header: 'What it is',
            cell: (row) => (
              <Link className="underline" to={recordPath(row)}>
                {row.addressLine ?? row.name ?? row.remoteId}
              </Link>
            ),
          },
          { key: 'datatype', header: 'Type', sortAs: 'datatype', cell: (row) => row.datatype },
          {
            key: 'remoteId',
            header: 'Record id',
            sortAs: 'remote_id',
            cell: (row) => <span className="font-mono text-xs">{row.remoteId}</span>,
          },
          { key: 'tenantId', header: 'Tenant', sortAs: 'tenant_id', cell: (row) => row.tenantId },
          {
            key: 'connectionId',
            header: 'Connection',
            sortAs: 'connection_id',
            cell: (row) => row.connectionId,
          },
          {
            key: 'officeId',
            header: 'Office',
            sortAs: 'office_id',
            cell: (row) => row.officeId ?? '—',
          },
          {
            key: 'updatedAt',
            header: 'Written',
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
            key: 'deleted',
            header: 'State',
            sortAs: 'deleted',
            cell: (row) => (
              <Badge tone={row.deleted ? 'muted' : 'ok'}>{row.deleted ? 'removed' : 'live'}</Badge>
            ),
          },
          { key: 'seq', header: 'Seq', sortAs: 'seq', cell: (row) => row.seq, optional: true },
          { key: 'rulesVersion', header: 'Rules', cell: (row) => row.rulesVersion, optional: true },
        ]}
        rows={rows}
        rowKey={keyOf}
        loading={query.isLoading}
        sort={sort}
        onSort={(next) => {
          const params_ = new URLSearchParams(params);
          params_.set('sort', next.field);
          params_.set('dir', next.order);
          setParams(params_, { replace: true });
        }}
        selected={selected}
        onSelect={(next) => {
          setSelected(next);
          if (next.size === 0) setAllMatching(false);
        }}
        allMatching={{
          on: allMatching,
          total,
          onChange: setAllMatching,
          what: 'record(s) matching these filters',
        }}
        selectionActions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void run('/runs/preview', 'Previewed. Nothing was written.')}
            >
              Preview a recompute
            </Button>
            <Confirm
              label="Recompute"
              title={`Recompute ${count(howMany)} record(s)`}
              what={`${count(howMany)} record(s) are computed again from what Core already stores, sold properties last. No CRM is called, and the sites are rung for whatever changed.`}
              confirmLabel="Recompute them"
              variant="danger"
              size="sm"
              onConfirm={() => run('/runs/recompute', 'The recompute is queued.')}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void run('/runs/fetch-again', 'Queued for the CRM.')}
            >
              Fetch again
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void ringTheirSites()}>
              Ring their sites
            </Button>
          </>
        }
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
              filtered
                ? 'Nothing matches these filters.'
                : 'Core holds no records yet. They arrive when a tenant’s CRM connection loads.'
            }
            next={
              filtered ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setParams(new URLSearchParams())}
                >
                  Clear the filters
                </Button>
              ) : (
                <Button size="sm" asChild>
                  <Link to="/tenants/new">Make a tenant</Link>
                </Button>
              )
            }
          />
        }
      />
    </>
  );
}
