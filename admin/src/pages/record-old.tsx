// The old record page, kept at /records-old/… only until the new one (record.tsx) is approved;
// then this file goes, with what only it uses. Nothing links here.
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useCustomMutation, useOne } from '@refinedev/core';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { Explained } from '@/components/explained';
import { JsonView } from '@/components/json-view';
import { PageHeader } from '@/components/layout';
import { anEntity, capital, crmName, exact, moment } from '@/lib/format';
import { officeLabel, tenantName } from '@/lib/scope';
import { useScopeOptions } from '@/components/scope-picker';
import type { RecordRow } from './records';

type TimelineEvent = {
  id: number;
  at: string;
  type: string;
  correlationId: string | null;
  /** What happened, in one sentence. The payload stays in the log and on the Events page. */
  said: string;
};

type RecordView = {
  row: RecordRow;
  raw: unknown;
  data: Record<string, unknown> | null;
  display: Record<string, unknown> | null;
  timeline: TimelineEvent[];
};

type Preview = {
  examined: number;
  changed: number;
  unchanged: number;
  failed: number;
  failures: { errors: string[] }[];
  examples: { changed: Record<string, { from: unknown; to: unknown }> }[];
};

export function OldRecordPage() {
  const { connection = '', datatype = '', id = '' } = useParams();
  const base = `/records/${encodeURIComponent(connection)}/${datatype}/${encodeURIComponent(id)}`;
  // A single record of the records resource, so the stream keeps its timeline current.
  const { result, query } = useOne<RecordView>({
    resource: 'records',
    id: `${encodeURIComponent(connection)}/${datatype}/${encodeURIComponent(id)}`,
  });
  const { mutateAsync } = useCustomMutation();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fromCrm, setFromCrm] = useState<unknown>(undefined);
  const options = useScopeOptions();

  // An answer that has not arrived is an empty object, so the page tests a field it needs.
  const record = result?.row ? result : null;

  const post = async <T,>(path: string, values: object = {}): Promise<T> => {
    const answer = await mutateAsync({
      url: path,
      method: 'post',
      values,
      successNotification: false,
      errorNotification: false,
    });
    return answer.data as unknown as T;
  };

  const say = async (what: () => Promise<string>): Promise<void> => {
    try {
      toast.success(await what());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Looking…</p>;
  if (!record) {
    return (
      <Empty
        what="Core holds no such record."
        next={
          <Button asChild size="sm">
            <Link to="/records">Back to the records</Link>
          </Button>
        }
      />
    );
  }

  const scope = { records: [{ connectionId: connection, datatype, remoteId: id }] };
  const row = record.row;
  const tenant = tenantName(options, row.tenantId);

  /** The five things one does about a record, each said beside its button (AGENTS.md, done 4). */
  const actions: { label: string; does: string; run: () => Promise<string> }[] = [
    {
      label: 'Fetch again',
      does: 'Asks the CRM for this record again and writes what differs. Press it when the CRM shows something the sites do not.',
      run: async () => (await post<{ detail: string }>('/runs/fetch-again', scope)).detail,
    },
    {
      label: 'Ask the CRM now',
      does: 'Fetches this record from the CRM and shows it on this page without writing anything, to compare with what Core holds.',
      run: async () => {
        setFromCrm(await post(`${base}/inspect`));
        return 'Fetched from the CRM and shown below. Nothing was written.';
      },
    },
    {
      label: 'Preview a recompute',
      does: 'Shows what a recompute would change in this record, without writing anything.',
      run: async () => {
        setPreview(await post<Preview>(`${base}/preview`));
        return 'Below is what a recompute would change. Nothing was written.';
      },
    },
    {
      label: 'Recompute',
      does: 'Works out this record’s fields again from what the CRM sent, with the current rules. When that changes the record, the sites get the new version.',
      run: async () => {
        await post('/runs/recompute', scope);
        return 'The recompute runs in a moment. If it changes the record, Flow shows it.';
      },
    },
    {
      label: 'Tell the sites',
      does: `Tells every site of ${tenant} to fetch its changes now. A site that already holds this record as it is fetches nothing new.`,
      run: async () => {
        await post(`/tenants/${String(row.tenantId)}/ring`);
        return `Told every site of ${tenant} to fetch its changes.`;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={row.addressLine ?? row.name ?? row.remoteId}
        what={
          <>
            {capital(anEntity(row.datatype))} of{' '}
            <Link className="underline" to={`/tenants/${String(row.tenantId)}`}>
              {tenant}
            </Link>
            , from its{' '}
            <Link
              className="underline"
              to={`/tenants/${String(row.tenantId)}#connection:${row.connectionId}`}
            >
              {crmName(row.provider)} connection, short name {row.connectionId}
            </Link>
            . The CRM’s id for it is {row.remoteId}.
            {row.officeId && (
              <>
                {' '}
                It belongs to the office{' '}
                <Link
                  className="underline"
                  to={`/records?tenant=${String(row.tenantId)}&office=${encodeURIComponent(row.officeId)}`}
                >
                  {officeLabel(options, row.officeId, row.tenantId)}
                </Link>
                .
              </>
            )}
          </>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>What you can do with it</CardTitle>
          <CardDescription>
            None of these can lose anything, and pressing one twice does no more than pressing it
            once.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {actions.map((action) => (
            <Explained key={action.label} what={action.does}>
              <Button variant="secondary" size="sm" onClick={() => void say(action.run)}>
                {action.label}
              </Button>
            </Explained>
          ))}
        </CardContent>
      </Card>

      <dl className="mb-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(0,16rem)_1fr]">
        <dt className="text-muted-foreground">On the sites</dt>
        <dd>
          <Badge tone={row.deleted ? 'muted' : 'ok'}>{row.deleted ? 'removed' : 'live'}</Badge>{' '}
          {row.deleted
            ? 'It left the CRM’s list. Core keeps it 90 days, and the sites no longer show it.'
            : 'The sites show it.'}
        </dd>
        <dt className="text-muted-foreground">Changed in Core</dt>
        <dd className="tabular-nums">{moment(row.updatedAt)}</dd>
        <dt className="text-muted-foreground">Changed in the CRM</dt>
        <dd className="tabular-nums">{moment(row.remoteUpdatedAt)}</dd>
        <dt className="text-muted-foreground">Made by rules version</dt>
        <dd>{row.rulesVersion}</dd>
        <dt className="text-muted-foreground">Data shape version</dt>
        <dd>{row.schemaVersion}</dd>
        <dt className="text-muted-foreground">Its number in the order sites fetch</dt>
        <dd className="tabular-nums">{row.seq}</dd>
      </dl>

      {preview && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>What a recompute would change</CardTitle>
            <CardDescription>
              {preview.changed > 0
                ? 'Nothing has been written. These are the fields that would change.'
                : 'Nothing would change: the record is already what the current rules produce.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {preview.failures.length > 0 && (
              <p className="mb-2 text-sm text-danger">
                The recompute would fail: {preview.failures[0]?.errors.join('; ')}
              </p>
            )}
            {preview.examples[0] && <JsonView value={preview.examples[0].changed} rows={12} />}
          </CardContent>
        </Card>
      )}

      {fromCrm !== undefined && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>From the CRM, just now</CardTitle>
            <CardDescription>
              Core fetched this record from the CRM and mapped it, without writing anything. Compare
              it with the unified record below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JsonView value={fromCrm} rows={16} />
          </CardContent>
        </Card>
      )}

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>What the CRM sent</CardTitle>
            <CardDescription>Exactly what the CRM sent, untouched.</CardDescription>
          </CardHeader>
          <CardContent>
            <JsonView value={record.raw} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>The unified record</CardTitle>
            <CardDescription>
              The CRM’s fields under Core’s own names, the same for every CRM. Every site receives
              this.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JsonView value={record.data} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>The texts ready to show</CardTitle>
            <CardDescription>
              The texts Core prepares from the unified record by its written rules, for a site to
              show as they are.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JsonView value={record.display} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What happened to it</CardTitle>
          <CardDescription>
            Everything that happened to this record, newest first: from the CRM’s message about a
            change to each site taking the record. The Events page shows each step in full.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                key: 'at',
                header: 'When',
                cell: (event) => <span className="tabular-nums">{exact(event.at)}</span>,
              },
              { key: 'said', header: 'What happened', cell: (event) => event.said },
              {
                key: 'correlation',
                header: 'From start to end',
                cell: (event) =>
                  event.correlationId ? (
                    <Link
                      className="underline"
                      to={`/events?correlation=${encodeURIComponent(event.correlationId)}`}
                    >
                      Show every step
                    </Link>
                  ) : (
                    '—'
                  ),
              },
            ]}
            rows={record.timeline}
            rowKey={(event) => String(event.id)}
            empty={
              <Empty what="Nothing has happened to this record since the log was last cleared." />
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
