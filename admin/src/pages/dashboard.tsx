// The dashboard, the first page after login: whether Core is well, what came in and what the
// sites got over the last 24 hours, and the latest events. It refreshes itself as things happen.
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Dashboard } from '@/api/types';
import { PageHeader, Section, Grid } from '@/components/page';
import { StatTile, Tiles } from '@/components/stat-tile';
import { BAD, Bars, HourlyChart, Meter } from '@/components/charts';
import { EventTable } from '@/components/event-table';
import { JobBadge, OkBad } from '@/components/state-badge';
import { Kv } from '@/components/kv';
import { Moment } from '@/components/moment';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fmtMs, fmtNumber } from '@/lib/format';

export const dashboardQuery = () => ({
  queryKey: ['dashboard'],
  queryFn: () => api<Dashboard>('/v1/admin/dashboard'),
  refetchInterval: 30_000,
});

const allFresh = (d: Dashboard): boolean =>
  d.sites.active === 0 || d.sites.fresh === d.sites.active;

function sitesContext(d: Dashboard): string {
  if (d.sites.active === 0) return 'no site is attached';
  if (allFresh(d)) return 'all pulled within the hour';
  const names = d.sites.waiting
    .slice(0, 3)
    .map((site) => site.label)
    .join(', ');
  const more = d.sites.waiting.length > 3 ? ` and ${d.sites.waiting.length - 3} more` : '';
  return `waiting on ${names}${more}`;
}

function Figures({ d }: { d: Dashboard }) {
  const checks = Object.values(d.health.checks);
  const passing = checks.filter((check) => check.ok).length;
  const waiting = d.figures.waiting + d.figures.jobs;
  return (
    <Tiles>
      <StatTile
        label="Health"
        value={d.health.ok ? 'ok' : 'failing'}
        state={d.health.ok ? 'ok' : 'bad'}
        context={`${passing} of ${checks.length} checks pass`}
      />
      <StatTile
        label="Live records"
        value={d.figures.live}
        context={`${fmtNumber(d.figures.tombstoned)} removed, kept 90 days`}
      />
      <StatTile
        label={`Written, last ${d.hours} h`}
        value={d.figures.written}
        context={`${fmtNumber(d.figures.unchanged)} unchanged`}
        spark={d.charts.records.series['entity.written']}
      />
      <StatTile
        label="Sites up to date"
        value={`${d.sites.fresh} of ${d.sites.active}`}
        state={d.sites.active === 0 ? undefined : allFresh(d) ? 'ok' : 'bad'}
        context={sitesContext(d)}
      />
      <StatTile
        label={`Bells, last ${d.hours} h`}
        value={d.figures.bells}
        state={d.figures.bellsFailed > 0 ? 'bad' : undefined}
        context={
          d.figures.bellsFailed > 0
            ? `${fmtNumber(d.figures.bellsFailed)} not answered`
            : 'all answered'
        }
        spark={d.charts.sites.series['bell']}
      />
      <StatTile
        label="Waiting for the worker"
        value={waiting}
        state={waiting > 0 ? 'warn' : 'ok'}
        context={
          waiting > 0
            ? `${d.figures.waiting} lifecycle event(s), ${d.figures.jobs} job(s)`
            : 'nothing queued'
        }
      />
    </Tiles>
  );
}

function Charts({ d }: { d: Dashboard }) {
  const records = d.charts.records.series;
  const sites = d.charts.sites.series;
  return (
    <Grid className="mb-4">
      <Section
        title={`Records per hour, last ${d.hours} hours`}
        help="What the adapters brought in: written, removed in the CRM, or dropped because it was malformed or of an unlicensed office."
      >
        <HourlyChart
          hours={d.charts.records.hours}
          caption="Records per hour"
          series={[
            { key: 'written', label: 'written', values: records['entity.written'] ?? [] },
            { key: 'removed', label: 'removed', values: records['entity.tombstoned'] ?? [] },
            {
              key: 'dropped',
              label: 'dropped',
              values: records['entity.dropped'] ?? [],
              colour: BAD,
            },
          ]}
        />
      </Section>
      <Section
        title={`Sites per hour, last ${d.hours} hours`}
        help="Bells Core rang, pages the sites pulled, and what they reported back: applied, or failed on their side."
      >
        <HourlyChart
          hours={d.charts.sites.hours}
          caption="Sites per hour"
          series={[
            { key: 'bells', label: 'bells', values: sites['bell'] ?? [] },
            { key: 'pulls', label: 'pulls', values: sites['pull'] ?? [] },
            { key: 'applied', label: 'applied', values: sites['site.applied'] ?? [] },
            { key: 'failed', label: 'failed', values: sites['site.failed'] ?? [], colour: BAD },
          ]}
        />
      </Section>
    </Grid>
  );
}

function Details({ d }: { d: Dashboard }) {
  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-3">
      <Section
        title="Records per datatype"
        help="Live records, and how many are removed and waiting to be purged."
      >
        <Bars
          rows={d.perDatatype.map((row) => ({
            label: row.datatype,
            value: row.live,
            note: `${fmtNumber(row.tombstoned)} removed`,
          }))}
        />
      </Section>
      <Section
        title="Sites"
        help="Whether every active site has pulled within the hour, and how long a pull takes to answer."
      >
        <Meter
          value={d.sites.fresh}
          of={d.sites.active}
          state={allFresh(d) ? 'ok' : 'bad'}
          label="pulled within the hour"
        />
        <div className="mt-4">
          <Kv
            rows={[
              [`Pulls, last ${d.hours} h`, fmtNumber(d.pulls.pulls)],
              ['Answer time, typical', fmtMs(d.pulls.p50)],
              ['Answer time, slowest 5 %', fmtMs(d.pulls.p95)],
            ]}
          />
        </div>
      </Section>
      <Section
        title={`Other activity, last ${d.hours} hours`}
        help="Everything else in the event log by type: the adapters’ calls to their CRMs, notifications, logins, jobs, alerts."
        flush
      >
        {d.other.length === 0 ? (
          <p className="px-5 text-sm text-muted-foreground">Nothing else happened.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Event type</TableHead>
                <TableHead className="pr-5 text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.other.slice(0, 10).map((row) => (
                <TableRow key={row.type}>
                  <TableCell className="pl-5 font-mono text-xs">{row.type}</TableCell>
                  <TableCell className="pr-5 text-right tabular-nums">
                    {fmtNumber(row.count)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

function HealthAndTenants({ d }: { d: Dashboard }) {
  return (
    <Grid className="mb-4">
      <Section
        title="Health"
        help="The same checks the platform and the uptime monitor read at /v1/health, live. A failing check says what is wrong; the adapters add checks of their own."
        flush
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Check</TableHead>
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(d.health.checks).map(([name, check]) => (
              <TableRow key={name} data-check={name}>
                <TableCell className="pl-5 font-mono text-xs">{name}</TableCell>
                <TableCell>
                  <OkBad ok={check.ok} detail={check.detail} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      <Section
        title="Records per tenant"
        help="Live records are what the sites get. Removed ones stay 90 days so that every site can delete them too."
        flush
      >
        {d.perTenant.length === 0 ? (
          <p className="px-5 text-sm text-muted-foreground">
            No records yet:{' '}
            <Link to="/tenants/new" className="text-primary hover:underline">
              make a tenant
            </Link>{' '}
            with its CRM login, and its records are loaded.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Tenant</TableHead>
                <TableHead>Datatype</TableHead>
                <TableHead className="text-right">Live</TableHead>
                <TableHead className="pr-5 text-right">Removed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.perTenant.map((row) => (
                <TableRow key={`${row.tenant_id}/${row.datatype}`}>
                  <TableCell className="pl-5">
                    <Link to={`/tenants/${row.tenant_id}`} className="text-primary hover:underline">
                      #{row.tenant_id}
                    </Link>
                  </TableCell>
                  <TableCell>{row.datatype}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(row.live)}</TableCell>
                  <TableCell className="pr-5 text-right tabular-nums">
                    {fmtNumber(row.tombstoned)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </Grid>
  );
}

function JobsRunning({ d }: { d: Dashboard }) {
  if (d.jobs.length === 0) return null;
  return (
    <Section
      title="Jobs running"
      help="Long operations the worker is on, watched live."
      className="mb-4"
      flush
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Job</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="pr-5">Started</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="pl-5">
                <Link to={`/jobs/${job.id}`} className="text-primary hover:underline">
                  #{job.id} {job.dry_run ? 'preview' : 'recompute'}
                </Link>
              </TableCell>
              <TableCell>
                <JobBadge state={job.state} />
              </TableCell>
              <TableCell className="tabular-nums">
                {fmtNumber(job.progress.examined ?? 0)} of {fmtNumber(job.progress.total ?? 0)}
              </TableCell>
              <TableCell className="pr-5">
                <Moment at={job.started_at} ago />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

export function DashboardPage() {
  const { data, isPending, error } = useQuery(dashboardQuery());
  if (isPending) return <Loading />;
  if (error) return <p className="text-bad">The dashboard could not load: {error.message}</p>;
  const d = data;
  return (
    <>
      <PageHeader
        title="Dashboard"
        intro={`What Core is doing right now and over the last ${d.hours} hours: whether every check passes, what came in, what the sites got, and the latest events.`}
      />
      <Figures d={d} />
      <Charts d={d} />
      <Details d={d} />
      <HealthAndTenants d={d} />
      <JobsRunning d={d} />
      <Section
        title="Latest events"
        help="The 20 newest things Core and its adapters did. The Events page searches the whole log."
        flush
      >
        <EventTable events={d.events} />
      </Section>
      <p className="mt-4 text-xs text-muted-foreground">
        Core {d.about.environment} · rules version {d.about.rulesVersion} · schema version{' '}
        {d.about.schemaVersion} · migrations {d.about.migrations.join(', ')}
      </p>
    </>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
