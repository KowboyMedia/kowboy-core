// Manual sync (U4, renamed from Runs on 2026-09-21): pick what to run it on — tenant, then its
// connection, then that connection's office, then the entity — preview what it would do, then run
// it. Recompute and fetch again take the same scope, so a person learns the pickers once.
import { useState } from 'react';
import { useCustomMutation, useList } from '@refinedev/core';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Confirm } from '@/components/confirm';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { JsonView } from '@/components/json-view';
import { PageHeader } from '@/components/layout';
import { useCustom } from '@refinedev/core';
import { count, moment } from '@/lib/format';

type Report = {
  total: number;
  examined: number;
  changed: number;
  unchanged: number;
  failed: number;
  failures: { remoteId: string; datatype: string; connectionId: string; errors: string[] }[];
  examples: { remoteId: string; datatype: string; changed: Record<string, unknown> }[];
};

type Job = {
  id: string;
  kind: string;
  scope: Record<string, unknown>;
  state: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  progress: { total?: number; examined?: number; changed?: number; failed?: number };
  result: Report | null;
  error: string | null;
  requested_by: string | null;
  created_at: string;
  finished_at: string | null;
};

const TONE = {
  queued: 'warn',
  running: 'warn',
  done: 'ok',
  failed: 'bad',
  cancelled: 'muted',
} as const;

export function ManualSync() {
  const [scope, setScope] = useState<ScopeValue>({});
  const [remoteId, setRemoteId] = useState('');
  const [staleRulesOnly, setStaleRulesOnly] = useState(false);
  const [report, setReport] = useState<{ scope: string; report: Report } | null>(null);
  const options = useScopeOptions();
  const { mutateAsync } = useCustomMutation();
  const { result, query } = useList<Job>({ resource: 'jobs', pagination: { mode: 'off' } });
  const jobs = result?.data ?? [];

  /** The scope as the admin API takes it: only what was actually picked. */
  const chosen = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    if (scope.tenantId) out['tenantId'] = Number(scope.tenantId);
    if (scope.connectionId) out['connectionId'] = scope.connectionId;
    if (scope.officeId) out['officeId'] = scope.officeId;
    if (scope.datatype) out['datatype'] = scope.datatype;
    if (remoteId.trim() !== '') out['remoteId'] = remoteId.trim();
    if (staleRulesOnly) out['staleRulesOnly'] = true;
    return out;
  };

  const post = async <T,>(url: string, values: object): Promise<T> => {
    const answer = await mutateAsync({
      url,
      method: 'post',
      values,
      successNotification: false,
      errorNotification: false,
    });
    return answer.data as unknown as T;
  };

  const narrowed = Object.keys(chosen()).length > 0;
  const said = narrowed ? 'the chosen scope' : 'every record in Core';

  const act = async (what: () => Promise<string>): Promise<void> => {
    try {
      toast.success(await what());
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <PageHeader
        title="Manual sync (old)"
        what="Compute records again from what Core stores, or fetch them from the CRM again. Preview first; every run is a job you can watch and stop."
      ></PageHeader>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>What to run it on</CardTitle>
          <CardDescription>
            Narrow it from the left: a tenant, then one of its CRM connections, then an office of
            that connection, then one kind of record. Leave a picker alone to include all of it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ScopePicker value={scope} onChange={setScope} options={options} />
            <div className="flex flex-col gap-1">
              <Label htmlFor="scope-record">One record id</Label>
              <Input
                id="scope-record"
                value={remoteId}
                placeholder="the whole scope"
                onChange={(event) => setRemoteId(event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={staleRulesOnly}
              onChange={(event) => setStaleRulesOnly(event.target.checked)}
            />
            Only records an older rules version made
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              data-testid="preview"
              onClick={() =>
                void act(async () => {
                  setReport(
                    await post<{ scope: string; report: Report }>('/runs/preview', chosen()),
                  );
                  return 'Previewed. Nothing was written.';
                })
              }
            >
              Preview
            </Button>
            <Confirm
              label="Recompute"
              title="Recompute"
              what={`Every record in ${said} is computed again from what Core already stores, sold properties last. No CRM is called. Each site is rung for whatever changed, and will pull it.`}
              confirmLabel="Start the recompute"
              onConfirm={() =>
                act(async () => {
                  const queued = await post<{ job: number; scope: string }>(
                    '/runs/recompute',
                    chosen(),
                  );
                  return `Job ${String(queued.job)} is queued for ${queued.scope}.`;
                })
              }
            />
            <Button
              variant="secondary"
              onClick={() =>
                void act(async () => {
                  const outcome = await post<{ detail: string }>('/runs/fetch-again', chosen());
                  return outcome.detail;
                })
              }
            >
              Fetch again from the CRM
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setScope({});
                setRemoteId('');
                setStaleRulesOnly(false);
              }}
            >
              Clear the scope
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fetching again asks the CRM for the same records and writes only what actually differs,
            so running it twice does no more than running it once.
          </p>
        </CardContent>
      </Card>

      {report && (
        <Card className="mb-4" data-testid="preview-report">
          <CardHeader>
            <CardTitle>What a recompute would do to {report.scope}</CardTitle>
            <CardDescription>Nothing has been written.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                examined <strong>{count(report.report.examined)}</strong>
              </span>
              <span>
                would change <strong>{count(report.report.changed)}</strong>
              </span>
              <span>
                unchanged <strong>{count(report.report.unchanged)}</strong>
              </span>
              <span className={report.report.failed > 0 ? 'text-danger' : ''}>
                would fail <strong>{count(report.report.failed)}</strong>
              </span>
            </div>
            {report.report.failed > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium">The records that would fail</p>
                <DataTable
                  columns={[
                    {
                      key: 'id',
                      header: 'Record',
                      cell: (row) => `${row.datatype} ${row.remoteId}`,
                    },
                    { key: 'connection', header: 'Connection', cell: (row) => row.connectionId },
                    { key: 'errors', header: 'Why', cell: (row) => row.errors.join('; ') },
                  ]}
                  rows={report.report.failures}
                  rowKey={(row) => `${row.connectionId}|${row.datatype}|${row.remoteId}`}
                  empty={<Empty what="None." />}
                />
              </div>
            )}
            {report.report.examples.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium">Examples of what would change</p>
                <JsonView value={report.report.examples} rows={14} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>Newest first, with what each one was asked to do.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: 'id', header: 'Job', cell: (job) => `#${job.id}` },
              {
                key: 'state',
                header: 'State',
                cell: (job) => <Badge tone={TONE[job.state]}>{job.state}</Badge>,
              },
              {
                key: 'progress',
                header: 'Progress',
                cell: (job) =>
                  job.progress.total === undefined
                    ? '—'
                    : `${count(job.progress.examined ?? 0)} of ${count(job.progress.total)} · ${count(job.progress.changed ?? 0)} changed · ${count(job.progress.failed ?? 0)} failed`,
              },
              {
                key: 'scope',
                header: 'Scope',
                cell: (job) =>
                  Object.keys(job.scope).length === 0 ? (
                    'everything'
                  ) : (
                    <code className="text-xs">{JSON.stringify(job.scope).slice(0, 120)}</code>
                  ),
              },
              { key: 'by', header: 'Asked by', cell: (job) => job.requested_by ?? '—' },
              {
                key: 'created',
                header: 'Started',
                cell: (job) => <span className="tabular-nums">{moment(job.created_at)}</span>,
              },
              {
                key: 'act',
                header: '',
                className: 'text-right',
                cell: (job) =>
                  job.finished_at === null ? (
                    <Confirm
                      label="Stop"
                      title={`Stop job #${job.id}`}
                      what="The job stops after the page of records it is working on. Whatever it has already written stays written; nothing is undone."
                      confirmLabel="Stop it"
                      size="sm"
                      onConfirm={() =>
                        act(async () => {
                          await post(`/jobs/${job.id}/cancel`, {});
                          return `Job #${job.id} will stop.`;
                        })
                      }
                    />
                  ) : job.error ? (
                    <span className="text-xs text-danger">{job.error}</span>
                  ) : (
                    ''
                  ),
              },
            ]}
            rows={jobs}
            rowKey={(job) => job.id}
            loading={query.isLoading}
            empty={
              <Empty what="Nothing has been run yet. A preview writes nothing; a recompute becomes a job here." />
            }
          />
        </CardContent>
      </Card>
    </>
  );
}

// ---- The picker this page was built on, kept with it until the page goes --------------------

type ScopeValue = {
  tenantId?: string;
  connectionId?: string;
  officeId?: string;
  datatype?: string;
};

type ScopeOptions = {
  tenants: {
    id: number;
    name: string;
    connections: { id: string; provider: string; offices: string[] }[];
  }[];
  datatypes: string[];
};

function useScopeOptions(): ScopeOptions {
  const { result } = useCustom<ScopeOptions>({ url: '/scope', method: 'get' });
  return { tenants: result?.data?.tenants ?? [], datatypes: result?.data?.datatypes ?? [] };
}

function ScopePicker({
  value,
  onChange,
  options,
}: {
  value: ScopeValue;
  onChange: (next: ScopeValue) => void;
  options: ScopeOptions;
}) {
  const tenant = options.tenants.find((one) => String(one.id) === value.tenantId);
  const connections = tenant?.connections ?? [];
  const connection = connections.find((one) => one.id === value.connectionId);
  const offices = [
    ...new Set((connection ? [connection] : connections).flatMap((one) => one.offices)),
  ].sort();
  const pick = (next: ScopeValue): void => onChange(next);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="scope-tenant">Tenant</Label>
        <Select
          id="scope-tenant"
          value={value.tenantId ?? ''}
          onChange={(event) => pick({ datatype: value.datatype, tenantId: event.target.value })}
        >
          <option value="">every tenant</option>
          {options.tenants.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="scope-connection">CRM connection</Label>
        <Select
          id="scope-connection"
          value={value.connectionId ?? ''}
          disabled={connections.length === 0}
          onChange={(event) =>
            pick({
              tenantId: value.tenantId,
              datatype: value.datatype,
              connectionId: event.target.value,
            })
          }
        >
          <option value="">
            {value.tenantId === undefined || value.tenantId === ''
              ? 'choose a tenant first'
              : 'every connection of this tenant'}
          </option>
          {connections.map((one) => (
            <option key={one.id} value={one.id}>
              {one.id} ({one.provider})
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="scope-office">Office</Label>
        <Select
          id="scope-office"
          value={value.officeId ?? ''}
          disabled={offices.length === 0}
          onChange={(event) => pick({ ...value, officeId: event.target.value })}
        >
          <option value="">
            {offices.length === 0 ? 'choose a tenant first' : 'every office'}
          </option>
          {offices.map((office) => (
            <option key={office} value={office}>
              {office}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="scope-datatype">Entity type</Label>
        <Select
          id="scope-datatype"
          value={value.datatype ?? ''}
          onChange={(event) => pick({ ...value, datatype: event.target.value })}
        >
          <option value="">every entity</option>
          {options.datatypes.map((datatype) => (
            <option key={datatype} value={datatype}>
              {datatype}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}
