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
import { Explained } from '@/components/explained';
import { PageHeader } from '@/components/layout';
import { useLive } from '@/lib/live';
import { SERIES } from '@/lib/series';
import { ago, capital, count, entity, moment } from '@/lib/format';
import { firstSentence, inWords } from '../../../engine/admin/words';

/** How much a failing check matters: P0 Core is down, P1 a customer is cut off, P2 worth a look, P3 for the record. */
type Level = 'P0' | 'P1' | 'P2' | 'P3';

/** Each level in words beside its name (question 172), as the alerts say it. */
const LEVEL_WORDS: Record<Level, string> = {
  P0: 'Core down',
  P1: 'Disrupted',
  P2: 'To look at',
  P3: 'For information',
};

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
  /** Each check's title, what it says while it passes, and the page where it is put right. */
  about: Record<string, { title: string; fine: string; page?: { to: string; label: string } }>;
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

/** How many tenants are enabled, in words that agree with the numbers. */
function enabledText(active: number, total: number): string {
  if (total === 0) return 'There is no tenant yet';
  if (total === 1) return active === 1 ? 'The one tenant is enabled' : 'The one tenant is disabled';
  if (active === total) return `All ${count(total)} tenants are enabled`;
  return `${count(active)} of the ${count(total)} tenants ${active === 1 ? 'is' : 'are'} enabled`;
}

/** A site's answer when Core last told it about changes: answered, refused, an error, or none. */
const answered = (status: string): string => {
  if (status === 'ok') return 'Answered';
  const code = /^http (\d+)$/.exec(status)?.[1];
  if (code === '401' || code === '403') return 'Refused';
  return code ? `Error code ${code}` : 'No answer';
};

/** Fetched when this page opens, so the charting library never weighs on the rest of the app. */
const DayChart = lazy(() => import('@/components/day-chart'));

/**
 * A check's sentence, with the page it names linked where the sentence names it, and that page
 * after the sentence when it does not.
 */
function Said({ text, page }: { text: string; page?: { to: string; label: string } }) {
  const at = page ? text.indexOf(page.label) : -1;
  if (!page) return <p className="text-sm text-muted-foreground">{text}</p>;
  if (at < 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {text} It is put right on{' '}
        <Link className="underline" to={page.to}>
          {page.label}
        </Link>
        .
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      {text.slice(0, at)}
      <Link className="underline" to={page.to}>
        {page.label}
      </Link>
      {text.slice(at + page.label.length)}
    </p>
  );
}

/** The line above the checks: whether anything is disrupted, and what to read next. */
function verdict(checks: [string, Check][]): { badge: string; tone: 'ok' | 'bad'; said: string } {
  const failing = checks.filter(([, check]) => !check.ok);
  const down = failing.find(([, check]) => levelOf(check) === 'P0');
  if (down) {
    return {
      badge: LEVEL_WORDS.P0,
      tone: 'bad',
      said: `${firstSentence(down[1].detail ?? 'Core is down.')} The red check below says what it means and what to do.`,
    };
  }
  const red = failing.filter(([, check]) => levelOf(check) === 'P1').length;
  if (red > 0) {
    return {
      badge: LEVEL_WORDS.P1,
      tone: 'bad',
      said: `${capital(inWords(red, 'check finds', 'checks find'))} a customer’s sites or forms disrupted. Each red check below says what is wrong and what to do.`,
    };
  }
  const amber = failing.filter(([, check]) => levelOf(check) === 'P2').length;
  if (amber > 0) {
    return {
      badge: 'Fine',
      tone: 'ok',
      said: `Nothing is disrupted. ${capital(inWords(amber, 'check has', 'checks have'))} something to look at below.`,
    };
  }
  return failing.length > 0
    ? {
        badge: 'Fine',
        tone: 'ok',
        said: 'Nothing is disrupted. The grey checks below are for information only.',
      }
    : { badge: 'Fine', tone: 'ok', said: 'Everything Core checks is working. Nothing needs you.' };
}

export function Overview() {
  const { result, query } = useCustom<Overview>({ url: '/overview', method: 'get' });
  useLive('overview', query.refetch);
  // An answer that has not arrived is an empty object, not undefined, so every read is guarded.
  const data = result?.data;
  const checks = Object.entries(data?.health?.checks ?? {});
  const verdictNow = verdict(checks);

  const perDatatype = new Map<string, number>();
  for (const row of data?.records ?? []) {
    perDatatype.set(row.datatype, (perDatatype.get(row.datatype) ?? 0) + row.live);
  }

  return (
    <>
      <PageHeader
        title="Overview"
        what="Whether Core is working, what needs a person, what Core did in the last 24 hours, and how each site is doing."
      >
        <span className="max-w-sm text-sm text-muted-foreground">
          Flow lists every record on its way from a CRM through Core to the sites, newest first, and
          shows where each one is. Open it when a change made in the CRM has not reached a site.
        </span>
        <Button asChild variant="outline">
          <Link to="/flow">Open Flow</Link>
        </Button>
      </PageHeader>

      {data?.maintenance && (
        <div className="mb-4 rounded-md border border-warn/50 bg-warn/10 p-3 text-sm">
          <strong>Maintenance is on.</strong> Core tells no site about changes and runs no
          recompute; the sites keep fetching on their own schedule. Turn it off in{' '}
          <Link className="underline" to="/settings">
            Settings
          </Link>{' '}
          when the work on Core is done.
        </div>
      )}

      <Card className="mb-4" data-testid="verdict">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {query.isLoading ? (
              'Looking…'
            ) : (
              <>
                <Badge tone={verdictNow.tone}>{verdictNow.badge}</Badge> {verdictNow.said}
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
                    <span className="font-medium">
                      {about?.title ?? 'A check Core has no title for'}
                    </span>
                    <Badge tone={check.ok ? 'ok' : TONE[levelOf(check)]}>
                      {check.ok ? 'Fine' : `${levelOf(check)} ${LEVEL_WORDS[levelOf(check)]}`}
                    </Badge>
                  </div>
                  {check.ok ? (
                    about?.fine && <p className="text-sm text-muted-foreground">{about.fine}</p>
                  ) : (
                    <Said text={check.detail ?? 'It fails, and says no more.'} page={about?.page} />
                  )}
                  {links.length > 0 ? (
                    <ul className="flex flex-col gap-0.5 text-xs">
                      {links.map((link) => (
                        <li key={link.to}>
                          <Link className="underline" to={link.to}>
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    check.names &&
                    check.names.length > 0 && (
                      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {check.names.map((named) => (
                          <li key={named}>{named}</li>
                        ))}
                      </ul>
                    )
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
            What needed a person in the last seven days, newest first: problems that change what the
            sites show, or that kept a visitor’s form from the brokerage. Each line says what
            happened, what it means for the sites and what to do, and the name in it opens that
            office, connection, site or form. Core also sends these by mail and to Slack, to where{' '}
            <Link className="underline" to="/settings">
              Settings
            </Link>{' '}
            shows: a refused login, a form that did not reach the brokerage and an office the CRM
            still refuses within two minutes; a site still not fetching a quarter of an hour after
            its line appeared, and its end; and the rest in one mail at 07:00. While Core itself is
            down, the rest waits until it is back.
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
                    {row.tenantId !== null && row.tenant && !row.what.includes(row.tenant) && (
                      <p className="text-xs">
                        <Link className="underline" to={`/tenants/${String(row.tenantId)}`}>
                          {row.tenant}
                        </Link>
                      </p>
                    )}
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
              How many records Core saved in each of the last 24 hours, how many pages of changes
              the sites fetched, how often Core told a site about changes, and how many records the
              sites took or could not take.
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
              The records on the sites now, for every tenant together.{' '}
              <Link className="underline" to="/tenants">
                {enabledText(data?.tenants?.active ?? 0, data?.tenants?.total ?? 0)}
              </Link>
              ; a disabled tenant’s sites keep what they show and get no changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {perDatatype.size === 0 ? (
              <Empty
                what="Core holds no records yet. Core fetches records once a tenant has a CRM connection whose login works."
                next={
                  <Explained what="Opens a new tenant’s page. The tenant’s name, its CRM login and its sites are filled in and saved there.">
                    <Button asChild size="sm">
                      <Link to="/tenants/new">Make the first tenant</Link>
                    </Button>
                  </Explained>
                }
              />
            ) : (
              <dl className="flex flex-col gap-1 text-sm">
                {[...perDatatype.entries()].map(([datatype, live]) => (
                  <div key={datatype} className="flex justify-between">
                    <dt>
                      <Link
                        className="text-muted-foreground underline"
                        to={`/records?datatype=${encodeURIComponent(datatype)}`}
                      >
                        {capital(entity(datatype, true))}
                      </Link>
                    </dt>
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
                    {job.state === 'queued'
                      ? 'A recompute waits to start. Core runs one recompute at a time.'
                      : `A recompute is running. ${count(job.progress.examined ?? 0)} of ${count(job.progress.total ?? 0)} records are done.`}
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
          <CardDescription>
            When each site last fetched its changes, and how the site answered the last time Core
            told it about changes. A site that refuses the call most likely holds another bell
            secret than its tenant’s page shows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                key: 'label',
                header: 'Site',
                cell: (row) => (
                  <Link
                    className="underline"
                    to={`/tenants/${String(row.tenantId)}#site:${String(row.id)}`}
                  >
                    {row.label}
                  </Link>
                ),
              },
              {
                key: 'tenant',
                header: 'Tenant',
                cell: (row) => (
                  <Link className="underline" to={`/tenants/${String(row.tenantId)}`}>
                    {row.tenant}
                  </Link>
                ),
              },
              {
                key: 'active',
                header: 'On or off',
                cell: (row) => (
                  <Badge tone={row.active ? 'ok' : 'muted'}>{row.active ? 'On' : 'Off'}</Badge>
                ),
              },
              { key: 'pull', header: 'Last fetch', cell: (row) => ago(row.lastPullAt) },
              { key: 'bell', header: 'Last told of changes', cell: (row) => ago(row.lastBellAt) },
              {
                key: 'status',
                header: 'Its answer',
                cell: (row) =>
                  row.lastBellStatus === null ? (
                    <span className="text-muted-foreground">Not told yet</span>
                  ) : (
                    <Badge tone={row.lastBellStatus === 'ok' ? 'ok' : 'bad'}>
                      {answered(row.lastBellStatus)}
                    </Badge>
                  ),
              },
            ]}
            rows={data?.sites ?? []}
            rowKey={(row) => String(row.id)}
            loading={query.isLoading}
            empty={
              <Empty
                what="No site yet. A site is added on its tenant’s page, under Tenants."
                next={
                  <Explained what="Opens a new tenant’s page. The site is added there, with its address and where on it Core tells it about changes, and saved with the tenant.">
                    <Button asChild size="sm">
                      <Link to="/tenants/new">Make a tenant with a site</Link>
                    </Button>
                  </Explained>
                }
              />
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
