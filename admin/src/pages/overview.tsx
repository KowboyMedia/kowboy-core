// Overview (U2, U5): the verdict first and nothing else above it, then the day, then the sites.
// One call feeds the page, and the live stream keeps it current without a reload.
import { lazy, Suspense } from 'react';
import { useCustom } from '@refinedev/core';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { useLive } from '@/lib/live';
import { SERIES } from '@/lib/series';
import { ago, count, moment } from '@/lib/format';

type Check = { ok: boolean; detail?: string; names?: string[] };

type SiteRow = {
  id: number;
  tenantId: number;
  tenant: string;
  label: string;
  active: boolean;
  lastPullAt: string | null;
  lastBellAt: string | null;
  lastBellStatus: string | null;
};

type NeedsAttention = {
  id: number;
  at: string;
  type: string;
  title: string;
  said: string;
  tenantId: number | null;
  tenant: string | null;
  connectionId: string | null;
};

type Overview = {
  health: { ok: boolean; checks: Record<string, Check> };
  maintenance: boolean;
  attention: NeedsAttention[];
  tenants: { total: number; active: number };
  records: { tenantId: number; datatype: string; live: number; tombstoned: number }[];
  day: { hours: ({ hour: string } & Record<string, number>)[]; totals: Record<string, number> };
  sites: SiteRow[];
  jobs: {
    id: string;
    kind: string;
    state: string;
    progress: { examined?: number; total?: number };
  }[];
};

/** What each health check is about, so a red one says where to go. */
const WHERE: Record<string, { to: string; label: string }> = {
  worker: { to: '/settings', label: 'Settings' },
  subscribers: { to: '/tenants', label: 'Tenants' },
  lifecycle: { to: '/flow', label: 'Flow' },
  database: { to: '/settings', label: 'Settings' },
  schema: { to: '/settings', label: 'Settings' },
};

/** Where one thing that needs attention is looked into: its tenant's page, or the sites. */
const lookInto = (row: NeedsAttention): { to: string; label: string } =>
  row.tenantId === null
    ? { to: '/tenants', label: 'Go to Tenants' }
    : { to: `/tenants/${String(row.tenantId)}`, label: 'Open the tenant' };

/** Fetched when this page opens, so the charting library never weighs on the rest of the app. */
const DayChart = lazy(() => import('@/components/day-chart'));

export function Overview() {
  const { result, query } = useCustom<Overview>({ url: '/overview', method: 'get' });
  useLive('overview', query.refetch);
  // An answer that has not arrived is an empty object, not undefined, so every read is guarded.
  const data = result?.data;
  const checks = Object.entries(data?.health?.checks ?? {});
  const red = checks.filter(([, check]) => !check.ok);

  const perDatatype = new Map<string, number>();
  for (const row of data?.records ?? []) {
    perDatatype.set(row.datatype, (perDatatype.get(row.datatype) ?? 0) + row.live);
  }

  return (
    <>
      <PageHeader
        title="Overview"
        what="Whether Core is well, what it did today, and how the sites are doing."
      >
        <Button asChild variant="outline">
          <Link to="/flow">See what is in flight</Link>
        </Button>
      </PageHeader>

      {data?.maintenance && (
        <div className="mb-4 rounded-md border border-warn/50 bg-warn/10 p-3 text-sm">
          <strong>Maintenance is on.</strong> The sites still pull as usual, but nothing is rung and
          no job is taken. Turn it off in{' '}
          <Link className="underline" to="/settings">
            Settings
          </Link>
          .
        </div>
      )}

      <Card className="mb-4" data-testid="verdict">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {query.isLoading ? (
              'Looking…'
            ) : data?.health?.ok ? (
              <>
                <Badge tone="ok">All green</Badge> Everything Core checks is working.
              </>
            ) : (
              <>
                <Badge tone="bad">{red.length} red</Badge> Something needs attention.
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map(([name, check]) => (
              <div
                key={name}
                className="flex flex-col gap-1 rounded-md border p-3"
                data-testid={`check-${name}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{name}</span>
                  <Badge tone={check.ok ? 'ok' : 'bad'}>{check.ok ? 'ok' : 'red'}</Badge>
                </div>
                {check.detail && <p className="text-sm text-muted-foreground">{check.detail}</p>}
                {check.names && check.names.length > 0 && (
                  <p className="text-xs text-muted-foreground">{check.names.join('; ')}</p>
                )}
                {!check.ok && WHERE[name] && (
                  <Link className="text-sm underline" to={WHERE[name]?.to ?? '/'}>
                    Go to {WHERE[name]?.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4" data-testid="attention">
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            The important things of the last seven days: an office taken off the sites, a connection
            paused after failures, a login the CRM refuses, and a site that stopped pulling. Each
            one was also sent once by mail and Slack, where Settings says those are set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: 'at', header: 'When', cell: (row) => moment(row.at) },
              {
                key: 'what',
                header: 'What happened',
                cell: (row) => (
                  <>
                    <span className="font-medium">{row.title}</span>
                    <span className="text-muted-foreground"> — {row.said}</span>
                  </>
                ),
              },
              {
                key: 'tenant',
                header: 'Tenant',
                cell: (row) => row.tenant ?? <span className="text-muted-foreground">—</span>,
              },
              {
                key: 'go',
                header: 'Look into it',
                cell: (row) => (
                  <Link className="underline" to={lookInto(row).to}>
                    {lookInto(row).label}
                  </Link>
                ),
              },
            ]}
            rows={data?.attention ?? []}
            rowKey={(row) => String(row.id)}
            loading={query.isLoading}
            empty={<Empty what="Nothing needed attention in the last seven days." />}
          />
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>The last 24 hours</CardTitle>
            <CardDescription>
              Records written, pulls, bells, and what the sites reported, hour by hour.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <Suspense fallback={<p className="text-sm text-muted-foreground">Drawing…</p>}>
                <DayChart hours={data?.day?.hours ?? []} />
              </Suspense>
            </div>
            <dl className="mt-3 flex flex-wrap gap-4 text-sm">
              {SERIES.map((series) => (
                <div key={series.key} className="flex gap-1">
                  <dt className="text-muted-foreground">{series.label}</dt>
                  <dd className="font-medium tabular-nums">
                    {count(data?.day?.totals?.[series.key] ?? 0)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What Core holds</CardTitle>
            <CardDescription>
              {count(data?.tenants?.active ?? 0)} of {count(data?.tenants?.total ?? 0)} tenants
              licensed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {perDatatype.size === 0 ? (
              <Empty
                what="Core holds no records yet."
                next={
                  <Button asChild size="sm">
                    <Link to="/tenants/new">Make the first tenant</Link>
                  </Button>
                }
              />
            ) : (
              <dl className="flex flex-col gap-1 text-sm">
                {[...perDatatype.entries()].map(([datatype, live]) => (
                  <div key={datatype} className="flex justify-between">
                    <dt className="text-muted-foreground">{datatype}</dt>
                    <dd className="font-medium tabular-nums">{count(live)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {(data?.jobs ?? []).length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="mb-1 text-sm font-medium">Running now</p>
                {(data?.jobs ?? []).map((job) => (
                  <p key={job.id} className="text-sm text-muted-foreground">
                    <Link className="underline" to="/manual-sync">
                      {job.kind} #{job.id}
                    </Link>{' '}
                    — {job.state}, {count(job.progress.examined ?? 0)} of{' '}
                    {count(job.progress.total ?? 0)}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>The sites</CardTitle>
          <CardDescription>When each site last pulled, and how the last bell went.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                key: 'label',
                header: 'Site',
                cell: (row) => (
                  <Link className="underline" to={`/tenants/${String(row.tenantId)}`}>
                    {row.label}
                  </Link>
                ),
              },
              { key: 'tenant', header: 'Tenant', cell: (row) => row.tenant },
              {
                key: 'active',
                header: 'On',
                cell: (row) => (
                  <Badge tone={row.active ? 'ok' : 'muted'}>{row.active ? 'yes' : 'no'}</Badge>
                ),
              },
              { key: 'pull', header: 'Last pull', cell: (row) => ago(row.lastPullAt) },
              { key: 'bell', header: 'Last bell', cell: (row) => ago(row.lastBellAt) },
              {
                key: 'status',
                header: 'It answered',
                cell: (row) =>
                  row.lastBellStatus === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <Badge tone={row.lastBellStatus === 'ok' ? 'ok' : 'bad'}>
                      {row.lastBellStatus}
                    </Badge>
                  ),
              },
            ]}
            rows={data?.sites ?? []}
            rowKey={(row) => String(row.id)}
            loading={query.isLoading}
            empty={
              <Empty
                what="No site is linked yet."
                next={
                  <Button asChild size="sm">
                    <Link to="/tenants/new">Make a tenant with a site</Link>
                  </Button>
                }
              />
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
