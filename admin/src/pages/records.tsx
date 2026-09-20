// Records (U3): the grid. Every filter, the sort, the page and the page size live in the address,
// so a filtered view is a link one can paste to a colleague (React-admin's pattern, read
// 2026-09-20). Ticked rows act on themselves: recompute, fetch again, ring the tenant's sites.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useCustomMutation, useList } from '@refinedev/core';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Confirm } from '@/components/confirm';
import { DataTable, type Sort } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { moment } from '@/lib/format';

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

const DATATYPES = ['property', 'agent', 'office', 'area', 'association', 'project'];

/** Which query parameter each filter is, and the label above its box. */
const FILTERS = [
  { key: 'q', label: 'Words in the record', placeholder: 'storgatan' },
  { key: 'tenant', label: 'Tenant number', placeholder: '1' },
  { key: 'connection', label: 'Connection', placeholder: 'acme-crm' },
  { key: 'office', label: 'Office', placeholder: 'M31529' },
  { key: 'id', label: 'Record id', placeholder: 'OBJ-1' },
  { key: 'from', label: 'Written from', placeholder: '2026-09-01' },
  { key: 'to', label: 'Written before', placeholder: '2026-09-21' },
] as const;

export const recordPath = (row: {
  connectionId: string;
  datatype: string;
  remoteId: string;
}): string =>
  `/records/${encodeURIComponent(row.connectionId)}/${row.datatype}/${encodeURIComponent(row.remoteId)}`;

export function Records() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { mutateAsync } = useCustomMutation();

  const set = (key: string, value: string): void => {
    const next = new URLSearchParams(params);
    if (value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const page = Number(params.get('page') ?? 1);
  const size = Number(params.get('size') ?? 50);
  const sort: Sort = {
    field: params.get('sort') ?? 'seq',
    order: params.get('dir') === 'asc' ? 'asc' : 'desc',
  };

  const filters = [
    ...FILTERS.map((filter) => ({
      field: filter.key,
      operator: 'eq' as const,
      value: params.get(filter.key) ?? '',
    })),
    { field: 'datatype', operator: 'eq' as const, value: params.get('datatype') ?? '' },
    { field: 'deleted', operator: 'eq' as const, value: params.get('deleted') ?? '' },
  ];

  const { result, query } = useList<RecordRow>({
    resource: 'records',
    pagination: { currentPage: page, pageSize: size },
    sorters: [{ field: sort.field, order: sort.order }],
    filters,
  });
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;

  const chosen = rows.filter((row) =>
    selected.has(`${row.connectionId}|${row.datatype}|${row.remoteId}`),
  );
  const asRecords = chosen.map((row) => ({
    connectionId: row.connectionId,
    datatype: row.datatype,
    remoteId: row.remoteId,
  }));

  const run = async (url: string, message: string): Promise<void> => {
    try {
      const answer = await mutateAsync({
        url,
        method: 'post',
        values: { records: asRecords },
        successNotification: false,
        errorNotification: false,
      });
      const detail = (answer.data as unknown as { detail?: string })?.detail;
      toast.success(detail ?? message);
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const ringTheirSites = async (): Promise<void> => {
    const tenants = [...new Set(chosen.map((row) => row.tenantId))];
    for (const tenantId of tenants) {
      await mutateAsync({
        url: `/tenants/${String(tenantId)}/ring`,
        method: 'post',
        values: {},
        successNotification: false,
        errorNotification: false,
      });
    }
    toast.success(`Rang the sites of ${tenants.length} tenant(s).`);
  };

  return (
    <>
      <PageHeader
        title="Records"
        what="Everything Core holds. Narrow it down, sort it, tick what you need and act on it."
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {FILTERS.map((filter) => (
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
            <Label htmlFor="filter-datatype">Entity type</Label>
            <Select
              id="filter-datatype"
              value={params.get('datatype') ?? ''}
              onChange={(event) => set('datatype', event.target.value)}
            >
              <option value="">any</option>
              {DATATYPES.map((datatype) => (
                <option key={datatype} value={datatype}>
                  {datatype}
                </option>
              ))}
            </Select>
          </div>
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
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
            >
              Clear the filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        caption={`${total.toLocaleString('en-GB')} record(s) match`}
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
          {
            key: 'rulesVersion',
            header: 'Rules',
            cell: (row) => row.rulesVersion,
            optional: true,
          },
        ]}
        rows={rows}
        rowKey={(row) => `${row.connectionId}|${row.datatype}|${row.remoteId}`}
        loading={query.isLoading}
        sort={sort}
        onSort={(next) => {
          const params_ = new URLSearchParams(params);
          params_.set('sort', next.field);
          params_.set('dir', next.order);
          setParams(params_, { replace: true });
        }}
        selected={selected}
        onSelect={setSelected}
        selectionActions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void run('/runs/preview', 'Previewed.')}
            >
              Preview a recompute
            </Button>
            <Confirm
              label="Recompute"
              title="Recompute the ticked records"
              what={`${chosen.length} record(s) are computed again from what Core already stores. No CRM is called, and the sites are rung for whatever changed.`}
              confirmLabel="Recompute them"
              variant="danger"
              size="sm"
              onConfirm={() => run('/runs/recompute', 'The recompute is queued.')}
            />
            <Confirm
              label="Fetch again"
              title="Fetch the ticked records from the CRM"
              what={`${chosen.length} record(s) are put on their adapter's fetch list and fetched from the CRM again. A record the CRM no longer has is removed.`}
              confirmLabel="Fetch them again"
              variant="danger"
              size="sm"
              onConfirm={() => run('/runs/fetch-again', 'Queued for the CRM.')}
            />
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
              params.size === 0
                ? 'Core holds no records yet. They arrive when a tenant’s CRM connection loads.'
                : 'Nothing matches these filters.'
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
