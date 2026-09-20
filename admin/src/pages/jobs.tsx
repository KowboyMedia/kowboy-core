// Jobs: start a recompute of any scope (always a preview first), and the history of runs with
// their progress and outcome.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { api } from '@/api/client';
import { providersQuery, tenantsQuery } from '@/api/queries';
import type { Job, Scope } from '@/api/types';
import { PageHeader, Section } from '@/components/page';
import { DataTable } from '@/components/data-table';
import { Moment } from '@/components/moment';
import { JobBadge } from '@/components/state-badge';
import { PreviewButton, describeScope } from '@/components/actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fmtNumber } from '@/lib/format';

const DATATYPES = ['property', 'agent', 'office', 'area', 'association', 'project'];

/** Everything, a CRM, a tenant, a connection, an office, a datatype: the scope of a recompute. */
export function ScopePicker({
  scope,
  onChange,
}: {
  scope: Scope;
  onChange: (scope: Scope) => void;
}) {
  const tenants = useQuery(tenantsQuery());
  const providers = useQuery(providersQuery());
  const set = (changes: Partial<Scope>): void => {
    const next = { ...scope, ...changes };
    for (const key of Object.keys(next) as (keyof Scope)[])
      if (next[key] === undefined || next[key] === '' || next[key] === false) delete next[key];
    onChange(next);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">CRM</Label>
        <Select
          value={scope.provider ?? 'any'}
          onValueChange={(value) => set({ provider: value === 'any' ? undefined : value })}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">every CRM</SelectItem>
            {(providers.data ?? []).map((p) => (
              <SelectItem key={p.provider} value={p.provider}>
                {p.provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Tenant</Label>
        <Select
          value={scope.tenantId ? String(scope.tenantId) : 'any'}
          onValueChange={(value) => set({ tenantId: value === 'any' ? undefined : Number(value) })}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">every tenant</SelectItem>
            {(tenants.data ?? []).map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                #{t.id} {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Connection</Label>
        <Input
          className="h-8"
          value={scope.connectionId ?? ''}
          onChange={(event) => set({ connectionId: event.target.value || undefined })}
          placeholder="any"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Office</Label>
        <Input
          className="h-8"
          value={scope.officeId ?? ''}
          onChange={(event) => set({ officeId: event.target.value || undefined })}
          placeholder="any"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Datatype</Label>
        <Select
          value={scope.datatype ?? 'any'}
          onValueChange={(value) => set({ datatype: value === 'any' ? undefined : value })}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">every datatype</SelectItem>
            {DATATYPES.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 pt-5 text-sm">
        <Checkbox
          checked={scope.staleRulesOnly === true}
          onCheckedChange={(value) => set({ staleRulesOnly: value === true ? true : undefined })}
        />
        only older rules versions
      </label>
    </div>
  );
}

export function JobsPage() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>({});
  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => (await api<{ jobs: Job[] }>('/v1/admin/jobs?limit=200')).jobs,
    refetchInterval: 5_000,
  });
  const columns: ColumnDef<Job, unknown>[] = [
    {
      id: 'id',
      header: '#',
      cell: ({ row }) => (
        <Link
          to={`/jobs/${row.original.id}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          #{row.original.id}
        </Link>
      ),
    },
    {
      id: 'kind',
      header: 'What',
      cell: ({ row }) => (row.original.dry_run ? 'preview' : 'recompute'),
    },
    { id: 'scope', header: 'Scope', cell: ({ row }) => describeScope(row.original.scope) },
    { id: 'state', header: 'State', cell: ({ row }) => <JobBadge state={row.original.state} /> },
    {
      id: 'progress',
      header: 'Examined',
      cell: ({ row }) => (
        <span className="tabular-nums">
          {fmtNumber(row.original.progress.examined ?? 0)} of{' '}
          {fmtNumber(row.original.progress.total ?? 0)}
        </span>
      ),
    },
    {
      id: 'changed',
      header: 'Changed',
      cell: ({ row }) => (
        <span className="tabular-nums">{fmtNumber(row.original.progress.changed ?? 0)}</span>
      ),
    },
    {
      id: 'failed',
      header: 'Failed',
      cell: ({ row }) => (
        <span
          className={
            (row.original.progress.failed ?? 0) > 0 ? 'tabular-nums text-bad' : 'tabular-nums'
          }
        >
          {fmtNumber(row.original.progress.failed ?? 0)}
        </span>
      ),
    },
    { id: 'requested_by', header: 'By', cell: ({ row }) => row.original.requested_by ?? '—' },
    {
      id: 'created_at',
      header: 'Queued',
      cell: ({ row }) => <Moment at={row.original.created_at} />,
    },
    {
      id: 'finished_at',
      header: 'Finished',
      cell: ({ row }) => <Moment at={row.original.finished_at} ago />,
    },
  ];
  return (
    <>
      <PageHeader
        title="Jobs"
        intro="Long operations run by the worker with progress, a result and a history. A recompute puts stored records back through the mappers and the rules with no CRM traffic; it always previews first."
      />
      <Section
        title="Recompute a scope"
        help="Pick what to recompute: everything, a CRM, a tenant, a connection, an office, a datatype, or only records an older rules version made. The preview examines every record and writes nothing; the job page then runs it for real."
        className="mb-4"
        actions={
          <PreviewButton
            scope={scope}
            label={`Preview: ${describeScope(scope)}`}
            variant="default"
            size="default"
          />
        }
      >
        <ScopePicker scope={scope} onChange={setScope} />
      </Section>
      <Section
        title="History"
        help="Every job, newest first. Open one for its progress, its failures and the changes it made."
        flush
      >
        <div className="px-5">
          <DataTable
            columns={columns}
            rows={jobs.data ?? []}
            rowId={(row) => String(row.id)}
            loading={jobs.isPending}
            empty="No jobs yet."
            rowLink={(row) => navigate(`/jobs/${row.id}`)}
          />
        </div>
      </Section>
    </>
  );
}
