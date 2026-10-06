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
import { ago, capital, count, moment } from '@/lib/format';

/** How much a failing check matters: P0 Core is down, P1 a customer is cut off, P2 worth a look, P3 for the record. */
type Level = 'P0' | 'P1' | 'P2' | 'P3';

type Check = { ok: boolean; detail?: string; names?: string[]; level?: Level };

/** A failing check's colour by its level (question 172): an alert is red, worth a look amber. */
const TONE: Record<Level, 'bad' | 'warn' | 'muted'> = {
  P0: 'bad',
  P1: 'bad',
  P2: 'warn',
  P3: 'muted',
};

/** A failing check without a level counts as P1. */
const levelOf = (check: Check): Level => check.level ?? 'P1';

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
  key: string;
  id: number;
  at: string;
  type: string;
  title: string;
  said: string;
  /** The thing itself, in words, its place in the admin area, and where it is when it does not say. */
  what: string;
  link: string;
  where: string | null;
  tenantId: number | null;
  tenant: string | null;
};

type Overview = {
  health: { ok: boolean; checks: Record<string, Check> };
  /** Each check's title and the page where it is put right. */
  about: Record<string, { title: string; page: { to: string; label: string } }>;
  /** The things a failing check names, each a link to its place. */
  links: Record<string, { label: string; to: string }[]>;
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

/** Fetched when this page opens, so the charting library never weighs on the rest of the app. */
const DayChart = lazy(() => import('@/components/day-chart'));

export function Overview() {
  const { result, query } = useCustom<Overview>({ url: '/overview', method: 'get' });
  useLive('overview', query.refetch);
  // An answer that has not arrived is an empty object, not undefined, so every read is guarded.
  const data = result?.data;
  const checks = Object.entries(data?.health?.checks ?? {});
  const failing = checks.filter(([, check]) => !check.ok);
  // The line above the checks counts the alerts only: P0 and P1 (question 172).
  const red = failing.filter(([, check]) => TONE[levelOf(check)] === 'bad');
  const amber = failing.filter(([, check]) => levelOf(check) === 'P2');

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
            ) : red.length > 0 ? (
              <>
                <Badge tone="bad">{red.length} red</Badge> Something needs attention now.
              </>
            ) : (
              <>
                <Badge tone="ok">No alerts</Badge>
                {amber.length > 0
                  ? 'Nothing needs attention now; the amber checks below are worth a look.'
                  : 'Nothing needs attention now; the grey checks below are only for the record.'}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map(([name, check]) => {
              const about = data?.about?.[name];
              const links = data?.links?.[name] ?? [];
              return (
                <div
                  key={name}
                  className="flex flex-col gap-1 rounded-md border p-3"
                  data-testid={`check-${name}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{about?.title ?? name}</span>
                    <Badge tone={check.ok ? 'ok' : TONE[levelOf(check)]}>
                      {check.ok ? 'ok' : levelOf(check)}
                    </Badge>
                  </div>
                  {check.detail && <p className="text-sm text-muted-foreground">{check.detail}</p>}
                  {links.length > 0 ? (
                    <p className="flex flex-wrap gap-x-3 text-xs">
                      {links.map((link) => (
                        <Link key={link.to} className="underline" to={link.to}>
                          {link.label}
                        </Link>
                      ))}
                    </p>
                  ) : (
                    check.names &&
                    check.names.length > 0 && (
                      <p className="text-xs text-muted-foreground">{check.names.join('; ')}</p>
                    )
                  )}
                  {!check.ok && about && (
                    <Link className="text-sm underline" to={about.page.to}>
                      Go to {about.page.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4" data-testid="attention">
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            Problems from the last seven days that change what the sites show, or that kept a
            visitor’s form from the brokerage. Each line says what happened and what to do, and the
            name in it opens the place where it is fixed. Core also sends, by mail and to Slack as
            Settings shows, a refused login, a form that did not reach the brokerage and an office
            the CRM still refuses within two minutes, a site once it is still not fetching a quarter
            of an hour after its line appeared, and the rest in one mail at 07:00. While Core itself
            is down, it sends only that, and the rest once it is back.
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
                    <p className="font-medium">{capital(row.title)}</p>
                    <p className="text-sm text-muted-foreground">{row.said}</p>
                  </>
                ),
              },
              {
                key: 'which',
                header: 'Which, and where',
                cell: (row) => (
                  <>
                    <Link className="font-medium underline" to={row.link}>
                      {row.what}
                    </Link>
                    {row.where && <p className="text-xs text-muted-foreground">{row.where}</p>}
                  </>
                ),
              },
            ]}
            rows={data?.attention ?? []}
            rowKey={(row) => row.key}
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
                    {job.kind} #{job.id} — {job.state}, {count(job.progress.examined ?? 0)} of{' '}
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
