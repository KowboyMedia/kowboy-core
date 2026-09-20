// One job: its progress live, what it changed and what failed, and the run for real after a
// preview.
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, messageOf } from '@/api/client';
import { recordPath } from '@/api/queries';
import type { Job, Report } from '@/api/types';
import { PageHeader, Section } from '@/components/page';
import { StatTile, Tiles } from '@/components/stat-tile';
import { JobBadge } from '@/components/state-badge';
import { Moment } from '@/components/moment';
import { Kv } from '@/components/kv';
import { Confirm } from '@/components/confirm';
import { describeScope } from '@/components/actions';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fmtNumber } from '@/lib/format';

type Numbers = Partial<Report>;

const n = (value: number | undefined): number => value ?? 0;

/** Stop while it runs; run for real once a preview has finished. */
function JobActions({ job, report }: { job: Job; report: Numbers }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => api(`/v1/admin/jobs/${job.id}/cancel`, { body: {} }),
    onSuccess: () => {
      toast.success('Stopping after the current batch; what was done stays done.');
      void client.invalidateQueries({ queryKey: ['job', String(job.id)] });
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const run = useMutation({
    mutationFn: () =>
      api<{ id: number }>('/v1/admin/jobs', {
        body: { kind: 'recompute', scope: job.scope, dryRun: false },
      }),
    onSuccess: ({ id }) => {
      toast.success(`Recompute #${id} is queued.`);
      void client.invalidateQueries({ queryKey: ['jobs'] });
      navigate(`/jobs/${id}`);
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const open = !job.finished_at;
  if (open) {
    return (
      <Button
        variant="outline"
        onClick={() => cancel.mutate()}
        disabled={cancel.isPending || job.cancel_requested}
      >
        {job.cancel_requested ? 'Stopping…' : 'Stop'}
      </Button>
    );
  }
  if (!job.dry_run) return null;
  return (
    <Confirm
      title="Run the recompute for real?"
      description={`${describeScope(job.scope)}: ${fmtNumber(n(report.changed))} record(s) would change and get a new seq, ${fmtNumber(n(report.failed))} would fail and stay as they are, and the tenants’ sites are rung.`}
      action="Run for real"
      onConfirm={() => run.mutateAsync().then(() => undefined)}
    >
      <Button data-testid="run-for-real">Run for real</Button>
    </Confirm>
  );
}

function Failures({ failures }: { failures: Report['failures'] }) {
  if (failures.length === 0) return null;
  return (
    <Section
      title="Records failing"
      help="These did not pass the mapper, the rules or the schema; they keep what they had. The first 200 are listed."
      flush
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Record</TableHead>
            <TableHead className="pr-5">Errors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {failures.map((failure) => (
            <TableRow key={`${failure.connectionId}/${failure.datatype}/${failure.remoteId}`}>
              <TableCell className="pl-5">
                <Link
                  to={recordPath(failure.connectionId, failure.datatype, failure.remoteId)}
                  className="text-primary hover:underline"
                >
                  {failure.datatype} {failure.remoteId}
                </Link>
                <div className="text-xs text-muted-foreground">{failure.connectionId}</div>
              </TableCell>
              <TableCell className="pr-5 font-mono text-xs text-bad">
                {failure.errors.join('; ')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function Examples({ examples }: { examples: Report['examples'] }) {
  if (examples.length === 0) return null;
  return (
    <Section
      title="Examples of what changes"
      help="Up to ten changed records with each field before and after."
      flush
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Record</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Before</TableHead>
            <TableHead className="pr-5">After</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {examples.flatMap((example) =>
            Object.entries(example.changed).map(([field, change], index) => (
              <TableRow
                key={`${example.connectionId}/${example.datatype}/${example.remoteId}/${field}`}
              >
                <TableCell className="pl-5">
                  {index === 0 && (
                    <Link
                      to={recordPath(example.connectionId, example.datatype, example.remoteId)}
                      className="text-primary hover:underline"
                    >
                      {example.datatype} {example.remoteId}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{field}</TableCell>
                <TableCell
                  className="max-w-xs truncate font-mono text-xs text-muted-foreground"
                  title={JSON.stringify(change.from)}
                >
                  {JSON.stringify(change.from)}
                </TableCell>
                <TableCell
                  className="max-w-xs truncate pr-5 font-mono text-xs"
                  title={JSON.stringify(change.to)}
                >
                  {JSON.stringify(change.to)}
                </TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </Section>
  );
}

function ProgressLine({ job, report }: { job: Job; report: Numbers }) {
  const total = n(report.total);
  const examined = n(report.examined);
  const share =
    total === 0 ? (job.finished_at ? 100 : 0) : Math.min(100, Math.round((examined / total) * 100));
  return (
    <div className="mb-4 flex flex-col gap-2">
      <Progress value={share} aria-label="Progress" />
      <div className="text-sm text-muted-foreground">
        {fmtNumber(examined)} of {fmtNumber(total)} examined
        {job.started_at && (
          <span>
            {' '}
            · started <Moment at={job.started_at} ago />
          </span>
        )}
        {job.finished_at && (
          <span>
            {' '}
            · finished <Moment at={job.finished_at} ago />
          </span>
        )}
      </div>
    </div>
  );
}

export function JobPage() {
  const { id = '' } = useParams();
  const job = useQuery({
    queryKey: ['job', id],
    queryFn: async () => (await api<{ job: Job }>(`/v1/admin/jobs/${id}`)).job,
    refetchInterval: (query) => (query.state.data?.finished_at ? false : 2_000),
  });
  if (job.isPending) return <Skeleton className="h-96" />;
  if (job.error) return <p className="text-bad">{job.error.message}</p>;
  return <JobView job={job.data} />;
}

function JobView({ job: j }: { job: Job }) {
  const report: Numbers = j.result ?? j.progress;
  const kind = j.dry_run ? 'Preview' : 'Recompute';
  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/jobs" className="text-primary hover:underline">
            Jobs
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {kind} #{j.id} <JobBadge state={j.state} />
          </span>
        }
        intro={`${describeScope(j.scope)}${j.dry_run ? ': every record examined, nothing written.' : ': changed records get a new seq and the sites are rung.'}`}
        actions={<JobActions job={j} report={report} />}
      />
      <ProgressLine job={j} report={report} />
      <Tiles>
        <StatTile
          label="Examined"
          value={n(report.examined)}
          context={`of ${fmtNumber(n(report.total))}`}
        />
        <StatTile
          label="Changed"
          value={n(report.changed)}
          context={j.dry_run ? 'would get a new seq' : 'got a new seq'}
        />
        <StatTile label="Unchanged" value={n(report.unchanged)} context="same content and rules" />
        <StatTile
          label="Failed"
          value={n(report.failed)}
          state={n(report.failed) > 0 ? 'bad' : undefined}
          context="did not pass the mapper, the rules or the schema"
        />
      </Tiles>
      <div className="flex flex-col gap-4">
        <Section title="About this job">
          <Kv
            rows={[
              ['Requested by', j.requested_by ?? '—'],
              ['Queued', <Moment key="q" at={j.created_at} />],
              [
                'Scope',
                <code key="s" className="text-xs">
                  {JSON.stringify(j.scope)}
                </code>,
              ],
              ['Error', j.error ? <span className="text-bad">{j.error}</span> : '—'],
            ]}
          />
        </Section>
        <Failures failures={report.failures ?? []} />
        <Examples examples={report.examples ?? []} />
      </div>
    </>
  );
}
