// One record (Patric, 2026-10-06, built from zero): to troubleshoot its way from the CRM to the
// sites, view its data and try a step again. The top says what it is and whose. "Where it is now"
// follows it through the CRM, Core and each site, each with the button that does that step again;
// the three buttons are Manual sync's three levels for this one record, through the same call.
// "What happened" is its history, one change at a time. "Its data" shows its three faces.
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useCustom, useCustomMutation, useSubscription } from '@refinedev/core';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Explained } from '@/components/explained';
import { PageHeader } from '@/components/layout';
import { useScopeOptions } from '@/components/scope-picker';
import {
  anEntity,
  capital,
  connectionNamed,
  counted,
  exact,
  moment,
  officeNamed,
} from '@/lib/format';
import { officeName, tenantName } from '@/lib/scope';
import type { RecordRow } from '@/pages/records';

/** One event of the record's history, as Core says it. */
type Step = {
  id: number;
  at: string;
  type: string;
  correlationId: string | null;
  said: string;
  site: { id: number; name: string } | null;
  seq: number | null;
};

/** What one site of the tenant last said about the record. */
type SiteReport = {
  id: number;
  name: string;
  took: { at: string; seq: number } | null;
  failed: { at: string; seq: number; detail: string | null } | null;
};

type RecordView = {
  row: RecordRow;
  raw: unknown;
  data: Record<string, unknown> | null;
  display: Record<string, unknown> | null;
  timeline: Step[];
  sites: SiteReport[];
  rulesVersion: string;
  keptDays: number;
  removedKeptDays: number;
};

/** The CRM's answer now, against Core's copy; null when the CRM has no such record. */
type Comparison = {
  differs: { field: string; core: unknown; crm: unknown }[] | null;
} | null;

/** A comparison's outcome, and the place of the copy it was made against. */
type Compared = { seq: number; outcome: { answer: Comparison } | { error: string } };

type Level = 'fetch' | 'recompute' | 'send';

/** A sentence from Core, starting with a capital unless it starts with a person's address. */
const sentence = (said: string): string => (/^\S+@/.test(said) ? said : capital(said));

/** A name inside a sentence, as a link to its place. */
function linked(text: string, name: string, to: string): ReactNode {
  const at = text.indexOf(name);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <Link className="underline" to={to}>
        {name}
      </Link>
      {text.slice(at + name.length)}
    </>
  );
}

/** A value of the unified record, short enough for a table cell. */
const shown = (value: unknown): string =>
  value === null || value === undefined
    ? 'nothing'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);

// ---- What happened -----------------------------------------------------------------------------

/** One change: the steps that share a chain, oldest first, and when the last of them happened. */
type Chain = { key: string; correlationId: string | null; steps: Step[]; last: string };

const WRITES = new Set(['entity.written', 'entity.tombstoned']);
const REPORTS = new Set(['site.applied', 'site.failed']);

/**
 * The history in changes. Steps that share a chain id belong together. A site's report carries no
 * chain id, so it joins the write that gave the record the place the site says it took.
 */
function chainsOf(timeline: Step[]): Chain[] {
  const ownKey = (step: Step): string =>
    step.correlationId ? `chain:${step.correlationId}` : `step:${String(step.id)}`;
  const writes = new Map<number, string>();
  for (const step of timeline) {
    if (WRITES.has(step.type) && step.seq !== null) writes.set(step.seq, ownKey(step));
  }
  const keyOf = (step: Step): string => {
    if (!REPORTS.has(step.type) || step.correlationId || step.seq === null) return ownKey(step);
    return writes.get(step.seq) ?? `place:${String(step.seq)}`;
  };
  const grouped = new Map<string, Chain>();
  for (const step of timeline) {
    const key = keyOf(step);
    const chain = grouped.get(key) ?? {
      key,
      correlationId: key.startsWith('chain:') ? key.slice('chain:'.length) : null,
      steps: [],
      last: step.at,
    };
    chain.steps.push(step);
    if (step.at > chain.last) chain.last = step.at;
    grouped.set(key, chain);
  }
  return [...grouped.values()]
    .map((chain) => ({ ...chain, steps: [...chain.steps].sort((a, b) => a.id - b.id) }))
    .sort((a, b) => b.last.localeCompare(a.last));
}

function History({ view, tenantId }: { view: RecordView; tenantId: number }) {
  const chains = chainsOf(view.timeline);
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>What happened</CardTitle>
        <CardDescription>
          Its history, newest change first. A change runs from the CRM’s message through Core to
          each site. The event log keeps {counted(view.keptDays, 'day', 'days')}
          {view.timeline.length >= 200 ? ', and only the newest 200 events are shown here' : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chains.length === 0 ? (
          <p className="text-sm">
            Nothing happened to it in the last {counted(view.keptDays, 'day', 'days')}.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {chains.map((chain) => (
              <li key={chain.key} className="rounded-md border p-3">
                <ol className="flex flex-col gap-1">
                  {chain.steps.map((step) => (
                    <li key={step.id} className="flex flex-col text-sm sm:flex-row sm:gap-3">
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {exact(step.at)}
                      </span>
                      <span>
                        {step.site
                          ? linked(
                              sentence(step.said),
                              step.site.name,
                              `/tenants/${String(tenantId)}#site:${String(step.site.id)}`,
                            )
                          : sentence(step.said)}
                      </span>
                    </li>
                  ))}
                </ol>
                {chain.correlationId && (
                  <Link
                    className="mt-2 inline-block text-sm underline"
                    to={`/events?correlation=${encodeURIComponent(chain.correlationId)}`}
                  >
                    This change in the event log, with its steps about other records
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Where it is now ---------------------------------------------------------------------------

/** What one site holds, from its own reports. */
function siteState(
  site: SiteReport,
  row: RecordRow,
  keptDays: number,
): { tone: 'ok' | 'warn' | 'bad' | 'muted'; label: string; text: string } {
  const failedLast = site.failed && (!site.took || site.failed.at > site.took.at);
  if (site.failed && failedLast)
    return {
      tone: 'bad',
      label: 'Could not take it',
      text: `On ${moment(site.failed.at)} the site said: ${site.failed.detail ?? 'it gave no reason'}.`,
    };
  if (!site.took)
    return {
      tone: 'muted',
      label: 'No report',
      text: `The site has not said it took it in the last ${counted(keptDays, 'day', 'days')}.`,
    };
  if (site.took.seq >= row.seq)
    return row.deleted
      ? {
          tone: 'ok',
          label: 'Took it off',
          text: `Took it off its pages on ${moment(site.took.at)}.`,
        }
      : { tone: 'ok', label: 'Has Core’s copy', text: `Took it on ${moment(site.took.at)}.` };
  return row.deleted
    ? {
        tone: 'warn',
        label: 'Not taken off yet',
        text: `Took an earlier copy on ${moment(site.took.at)}. Core has since told it to take the record off, and the site has not said it did.`,
      }
    : {
        tone: 'warn',
        label: 'Has an earlier copy',
        text: `Took it on ${moment(site.took.at)}. Core has sent it since, and the site has not said it took that yet.`,
      };
}

/** A button that runs one step for this record, busy while Core answers. */
function RunButton({ label, onRun }: { label: string; onRun: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void onRun().finally(() => setBusy(false));
      }}
    >
      {busy ? 'Working…' : label}
    </Button>
  );
}

function ComparisonOutcome({
  outcome,
  connectionPage,
}: {
  outcome: Compared['outcome'];
  connectionPage: string;
}) {
  if ('error' in outcome)
    return (
      <p className="text-sm text-danger">
        The CRM could not be asked: {outcome.error.replace(/\.$/, '')}. The connection’s login is on{' '}
        <Link className="underline" to={connectionPage}>
          the tenant’s page
        </Link>
        .
      </p>
    );
  const { answer } = outcome;
  if (answer === null)
    return <p className="text-sm">The CRM answered that it has no such record.</p>;
  if (answer.differs === null)
    return (
      <p className="text-sm">
        The CRM answered, but Core cannot read its answer for this kind of record.
      </p>
    );
  if (answer.differs.length === 0)
    return <p className="text-sm">The CRM’s answer matches Core’s copy.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {counted(answer.differs.length, 'field differs', 'fields differ')} from Core’s copy. Fetch
        again brings Core’s copy up to date.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-3 font-medium">Field of the unified record</th>
              <th className="py-1 pr-3 font-medium">In Core</th>
              <th className="py-1 font-medium">In the CRM now</th>
            </tr>
          </thead>
          <tbody>
            {answer.differs.map((difference) => (
              <tr key={difference.field} className="border-b align-top">
                <td className="py-1 pr-3 font-mono text-xs">{difference.field}</td>
                <td className="max-w-xs break-words py-1 pr-3">{shown(difference.core)}</td>
                <td className="max-w-xs break-words py-1">{shown(difference.crm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Where({
  view,
  run,
  compare,
  comparison,
}: {
  view: RecordView;
  run: (level: Level) => Promise<void>;
  compare: () => Promise<void>;
  comparison: Compared | null;
}) {
  const { row } = view;
  const tenantPage = `/tenants/${String(row.tenantId)}`;
  // A comparison made against an earlier copy says nothing about this one.
  const outcome = comparison?.seq === row.seq ? comparison.outcome : null;
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Where it is now</CardTitle>
        <CardDescription>
          A record goes from the CRM to Core, and from Core to each site. Each step has the button
          that does it again, and every later step with it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-5">
          <li className="flex flex-col gap-2">
            <h4 className="font-medium">1. In the CRM</h4>
            {row.deleted ? (
              <p className="text-sm">
                Core took it off the sites on {moment(row.updatedAt)}. A removed record is not
                fetched, recomputed or sent again.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  {row.remoteUpdatedAt
                    ? `The CRM last changed it on ${moment(row.remoteUpdatedAt)}.`
                    : 'The CRM gives no time for its last change.'}
                </p>
                <Explained what="Asks the CRM for this record now and lists the fields that differ from Core’s copy. Nothing is stored, and the sites see nothing. Press it when a site shows something other than the CRM.">
                  <RunButton label="Compare with the CRM now" onRun={compare} />
                </Explained>
                {outcome && (
                  <ComparisonOutcome
                    outcome={outcome}
                    connectionPage={`${tenantPage}#connection:${row.connectionId}`}
                  />
                )}
                <Explained what="Asks the CRM for this record again, builds Core’s copy again from the answer and sends it to the sites. Press it when Core’s copy is out of date.">
                  <RunButton label="Fetch again" onRun={() => run('fetch')} />
                </Explained>
              </>
            )}
          </li>

          <li className="flex flex-col gap-2">
            <h4 className="font-medium">2. In Core</h4>
            {row.deleted ? (
              <p className="text-sm">
                Core keeps a removed record for {counted(view.removedKeptDays, 'day', 'days')}, so
                its history and data can still be read here.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  Core last stored it on {moment(row.updatedAt)}.{' '}
                  {row.rulesVersion === view.rulesVersion
                    ? 'Its texts were made by the rules Core runs today.'
                    : 'Its texts were made by older rules than Core runs today.'}
                </p>
                <Explained what="Builds Core’s copy again from what the CRM last sent, by the rules Core runs today, and sends it to the sites. The CRM is not asked. Press it when its data or texts look wrong, or were made by older rules.">
                  <RunButton label="Recompute" onRun={() => run('recompute')} />
                </Explained>
              </>
            )}
          </li>

          <li className="flex flex-col gap-2">
            <h4 className="font-medium">3. On the sites</h4>
            {view.sites.length === 0 ? (
              <p className="text-sm">
                The tenant has no site, so the record reaches none.{' '}
                <Link className="underline" to={tenantPage}>
                  Add one on the tenant’s page.
                </Link>
              </p>
            ) : (
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,16rem)_1fr]">
                {view.sites.map((site) => {
                  const state = siteState(site, row, view.keptDays);
                  return (
                    <div key={site.id} className="contents">
                      <dt>
                        <Link className="underline" to={`${tenantPage}#site:${String(site.id)}`}>
                          {site.name}
                        </Link>
                      </dt>
                      <dd className="flex flex-wrap items-center gap-2">
                        <Badge tone={state.tone}>{state.label}</Badge>
                        <span>{state.text}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
            {view.sites.length > 0 && (
              <p className="text-xs text-muted-foreground">
                From what each site reported in the last {counted(view.keptDays, 'day', 'days')}.
              </p>
            )}
            {!row.deleted && view.sites.length > 0 && (
              <Explained what="Sends this record to every site of the tenant again, as Core holds it now, and tells them to fetch it. Press it when a site lacks it or has an earlier copy.">
                <RunButton label="Send again" onRun={() => run('send')} />
              </Explained>
            )}
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}

// ---- Its data ----------------------------------------------------------------------------------

/** The three faces of a record, as AGENTS.md names them. */
const FACES = [
  { key: 'display', label: 'The texts ready to show' },
  { key: 'data', label: 'The unified record' },
  { key: 'raw', label: 'What the CRM sent' },
] as const;

function Faces({ view }: { view: RecordView }) {
  const [open, setOpen] = useState<(typeof FACES)[number]['key']>('display');
  const [copied, setCopied] = useState(false);
  const face = FACES.find((one) => one.key === open) ?? FACES[0];
  const unified = view.data
    ? Object.fromEntries(Object.entries(view.data).filter(([key]) => key !== 'display'))
    : null;
  const value = { display: view.display, data: unified, raw: view.raw }[face.key];
  const text = JSON.stringify(value ?? null, null, 2);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Its data</CardTitle>
        <CardDescription>
          The record as Core holds it, in three forms; pick one to see it. “The texts ready to show”
          are the texts the sites show, made by the rules. “The unified record” is the CRM’s fields
          under Core’s own names, the same for every CRM. “What the CRM sent” is its answer,
          untouched.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div role="tablist" aria-label="The record’s forms" className="flex flex-wrap gap-1">
          {FACES.map((one) => (
            <Button
              key={one.key}
              role="tab"
              id={`face-${one.key}`}
              aria-selected={open === one.key}
              aria-controls="face-panel"
              size="sm"
              variant={open === one.key ? 'default' : 'outline'}
              onClick={() => {
                setOpen(one.key);
                setCopied(false);
              }}
            >
              {one.label}
            </Button>
          ))}
        </div>
        <div
          role="tabpanel"
          id="face-panel"
          aria-labelledby={`face-${face.key}`}
          className="flex flex-col gap-3"
        >
          {value === null || value === undefined ? (
            <p className="text-sm">Nothing: the record was removed.</p>
          ) : (
            <>
              <Explained what="Copies what is shown below as text, to paste into a message or a file.">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(text)
                      .then(() => setCopied(true))
                      .catch(() => undefined);
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </Explained>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-3 font-mono text-xs">
                {text}
              </pre>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- The page ----------------------------------------------------------------------------------

/** The page starts afresh for each record, so nothing of one record stays on the next. */
export function RecordPage() {
  const params = useParams();
  const connection = params['connection'] ?? '';
  const datatype = params['datatype'] ?? '';
  const remoteId = params['id'] ?? '';
  return (
    <OneRecord
      key={`${connection}/${datatype}/${remoteId}`}
      connection={connection}
      datatype={datatype}
      remoteId={remoteId}
    />
  );
}

function OneRecord({
  connection,
  datatype,
  remoteId,
}: {
  connection: string;
  datatype: string;
  remoteId: string;
}) {
  const path = `/records/${encodeURIComponent(connection)}/${encodeURIComponent(datatype)}/${encodeURIComponent(remoteId)}`;
  const options = useScopeOptions();
  const { result, query } = useCustom<RecordView>({
    url: path,
    method: 'get',
    errorNotification: false,
  });
  const { mutateAsync } = useCustomMutation();
  const [comparison, setComparison] = useState<Compared | null>(null);

  // Follow along: read the record again whenever the event log gains an event about it.
  useSubscription({
    channel: 'resources/records',
    types: ['*'],
    onLiveEvent: (event) => {
      const fresh = (event.payload as { payload?: unknown }).payload;
      const about = (one: unknown): boolean => {
        const step = one as { connectionId?: string; datatype?: string; remoteId?: string };
        return (
          step.connectionId === connection &&
          step.datatype === datatype &&
          step.remoteId === remoteId
        );
      };
      if (Array.isArray(fresh) && fresh.some(about)) void query.refetch();
    },
  });

  const run = async (level: Level): Promise<void> => {
    try {
      const answer = await mutateAsync({
        url: '/runs/sync',
        method: 'post',
        values: { level, records: [{ connectionId: connection, datatype, remoteId }] },
        successNotification: false,
        errorNotification: false,
      });
      toast.success((answer.data as unknown as { detail: string }).detail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const compare = async (seq: number): Promise<void> => {
    try {
      const answer = await mutateAsync({
        url: `${path}/inspect`,
        method: 'post',
        values: {},
        successNotification: false,
        errorNotification: false,
      });
      setComparison({ seq, outcome: { answer: answer.data as unknown as Comparison } });
    } catch (error) {
      setComparison({
        seq,
        outcome: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  };

  // Until Core answers, the hook holds an empty object rather than nothing.
  const view = result?.data?.row ? result.data : undefined;
  if (!view) {
    return (
      <>
        <PageHeader
          title={query.isError ? 'Core cannot show this record' : 'Reading the record…'}
          what={
            query.isError ? (
              <>
                {query.error?.message ?? 'Core could not read it.'}{' '}
                <Link className="underline" to="/records">
                  Find it on Records.
                </Link>
              </>
            ) : (
              ''
            )
          }
        />
      </>
    );
  }

  const { row } = view;
  const tenant = tenantName(options, row.tenantId);
  const tenantPage = `/tenants/${String(row.tenantId)}`;
  const office =
    row.officeId === null
      ? ''
      : officeNamed(row.officeId, officeName(options, row.officeId, row.tenantId));
  return (
    <>
      <PageHeader
        title={
          row.addressLine ??
          row.name ??
          `${capital(anEntity(row.datatype))}, the CRM’s id ${row.remoteId}`
        }
        what={
          <>
            {capital(anEntity(row.datatype))} of{' '}
            <Link className="underline" to={tenantPage}>
              {tenant}
            </Link>
            {row.officeId !== null && row.datatype !== 'office' && (
              <>
                {' '}
                at{' '}
                <Link
                  className="underline"
                  to={`/records?tenant=${String(row.tenantId)}&office=${encodeURIComponent(row.officeId)}`}
                >
                  {office}
                </Link>
              </>
            )}
            . It comes from{' '}
            <Link className="underline" to={`${tenantPage}#connection:${row.connectionId}`}>
              {connectionNamed(row.connectionName, tenant, row.provider)}
            </Link>
            , where its id is {row.remoteId}.
          </>
        }
      />
      <Where view={view} run={run} compare={() => compare(row.seq)} comparison={comparison} />
      <History view={view} tenantId={row.tenantId} />
      <Faces view={view} />
    </>
  );
}
