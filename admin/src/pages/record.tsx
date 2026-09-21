// One record (U3): the CRM's payload, the unified record and the prepared strings side by side,
// the timeline under them, and the four things one does about it — fetch it again, recompute it,
// ring the sites, ask the CRM now — on the page itself rather than on a tools page.
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useCustomMutation, useOne } from '@refinedev/core';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { JsonView } from '@/components/json-view';
import { PageHeader } from '@/components/layout';
import { exact, moment } from '@/lib/format';
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

export function RecordPage() {
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

  return (
    <>
      <PageHeader
        title={record.row.addressLine ?? record.row.name ?? record.row.remoteId}
        what={`${record.row.datatype} ${record.row.remoteId} · tenant ${String(record.row.tenantId)} · ${record.row.connectionId}${record.row.officeId ? ` · office ${record.row.officeId}` : ''}`}
      >
        <Button
          variant="secondary"
          onClick={() =>
            void say(async () => {
              setPreview(await post<Preview>(`${base}/preview`));
              return 'That is what a recompute would change.';
            })
          }
        >
          Preview a recompute
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void say(async () => {
              await post('/runs/recompute', scope);
              return 'The recompute is queued; watch it on Manual sync.';
            })
          }
        >
          Recompute
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void say(async () => {
              const outcome = await post<{ detail: string }>('/runs/fetch-again', scope);
              return outcome.detail;
            })
          }
        >
          Fetch again
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void say(async () => {
              setFromCrm(await post(`${base}/inspect`));
              return 'Fetched from the CRM. Nothing was written.';
            })
          }
        >
          Ask the CRM now
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void say(async () => {
              await post(`/tenants/${String(record.row.tenantId)}/ring`);
              return 'Rang the tenant’s sites.';
            })
          }
        >
          Ring the sites
        </Button>
      </PageHeader>

      <p className="mb-3 text-xs text-muted-foreground">
        None of these can lose anything: a recompute rebuilds this record from what Core already
        stores, fetching again asks the CRM for the same record and writes only what differs, and a
        bell only tells the sites to pull. Running any of them twice does no more than once.
      </p>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Badge tone={record.row.deleted ? 'muted' : 'ok'}>
          {record.row.deleted ? 'removed' : 'live'}
        </Badge>
        <Badge tone="neutral">seq {record.row.seq}</Badge>
        <Badge tone="neutral">rules {record.row.rulesVersion}</Badge>
        <Badge tone="neutral">schema {record.row.schemaVersion}</Badge>
        <span className="text-muted-foreground">
          written {moment(record.row.updatedAt)} · changed in the CRM{' '}
          {moment(record.row.remoteUpdatedAt)}
        </span>
      </div>

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
                It would fail: {preview.failures[0]?.errors.join('; ')}
              </p>
            )}
            {preview.examples[0] && <JsonView value={preview.examples[0].changed} rows={12} />}
          </CardContent>
        </Card>
      )}

      {fromCrm !== undefined && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>The CRM, just now</CardTitle>
            <CardDescription>
              Fetched and mapped on the spot; nothing was written. Compare it with what Core holds.
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
            <CardTitle>The CRM’s payload</CardTitle>
            <CardDescription>Exactly what the CRM sent, untouched.</CardDescription>
          </CardHeader>
          <CardContent>
            <JsonView value={record.raw} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>The unified record</CardTitle>
            <CardDescription>What every site receives, whichever CRM it came from.</CardDescription>
          </CardHeader>
          <CardContent>
            <JsonView value={record.data} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>The prepared strings</CardTitle>
            <CardDescription>What the rules ledger makes of it, ready to show.</CardDescription>
          </CardHeader>
          <CardContent>
            <JsonView value={record.display} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Its timeline</CardTitle>
          <CardDescription>
            Everything that touched this record, newest first, from the CRM’s notification to each
            site’s apply. The whole of each event, payload and all, is on Events.
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
                key: 'type',
                header: 'Type',
                cell: (event) => <Badge tone="muted">{event.type}</Badge>,
                optional: true,
              },
              {
                key: 'correlation',
                header: 'Chain',
                cell: (event) =>
                  event.correlationId ? (
                    <Link
                      className="font-mono text-xs underline"
                      to={`/events?correlation=${encodeURIComponent(event.correlationId)}`}
                    >
                      follow
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
