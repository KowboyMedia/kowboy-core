// One record: where it comes from, its place in the change sequence, raw, unified and display
// side by side, its timeline from the CRM's notification to the sites, and the actions on it.
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ItemDetail } from '@/api/types';
import { PageHeader, Section } from '@/components/page';
import { Kv } from '@/components/kv';
import { Moment } from '@/components/moment';
import { JsonView } from '@/components/json-view';
import { EventTable } from '@/components/event-table';
import { YesNo } from '@/components/state-badge';
import { PreviewButton, RefetchButton, RingButton } from '@/components/actions';
import { Skeleton } from '@/components/ui/skeleton';

export function RecordPage() {
  const { connection = '', datatype = '', id = '' } = useParams();
  const navigate = useNavigate();
  const detail = useQuery({
    queryKey: ['item', connection, datatype, id],
    queryFn: () =>
      api<ItemDetail>(
        `/v1/admin/items/${encodeURIComponent(connection)}/${datatype}/${encodeURIComponent(id)}`,
      ),
  });
  if (detail.isPending) return <Skeleton className="h-96" />;
  if (detail.error) return <p className="text-bad">{detail.error.message}</p>;
  const d = detail.data;
  const item = d.item;
  const scope = {
    keys: [{ connectionId: item.connection_id, datatype: item.datatype, remoteId: item.remote_id }],
  };
  return (
    <>
      <PageHeader
        eyebrow={
          <span>
            {item.datatype} ·{' '}
            <Link to={`/tenants/${item.tenant_id}`} className="text-primary hover:underline">
              tenant #{item.tenant_id}
            </Link>{' '}
            · {item.connection_id}
          </span>
        }
        title={item.remote_id}
        intro="Three faces of one record: raw as the CRM sent it, unified on the universal names, and the display strings the ledger gives. Never a hand edit."
        actions={
          <>
            <PreviewButton scope={scope} label="Preview recompute" />
            <RefetchButton scope={scope} label="Fetch again from the CRM" />
            <RingButton tenantId={item.tenant_id} />
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <Section
          title="Where it stands"
          help="Its place in the change sequence, when it was written, and what version of the rules and schema made it."
        >
          <Kv
            rows={[
              [
                'Seq',
                <span key="seq" className="tabular-nums">
                  {item.seq}
                </span>,
              ],
              [
                'Office',
                item.office_id ?? <span className="text-muted-foreground">tenant-wide</span>,
              ],
              ['Written in Core', <Moment key="w" at={item.updated_at} />],
              ['Changed in the CRM', <Moment key="c" at={item.remote_updated_at} />],
              ['Removed', <YesNo key="r" value={item.deleted} yes="removed" no="live" />],
              ['Rules version', item.rules_version],
              ['Schema version', item.schema_version],
              [
                'Content hash',
                <code key="h" className="text-xs">
                  {item.content_hash}
                </code>,
              ],
            ]}
          />
        </Section>
        <div className="grid gap-4 xl:grid-cols-3">
          <JsonView title="Raw, as the CRM sent it" value={d.raw} openDepth={1} />
          <JsonView title="Unified" value={d.unified} openDepth={1} />
          <JsonView title="Display" value={d.display} openDepth={2} />
        </div>
        <Section
          title="Timeline"
          help="Everything that happened to this record, newest first: the CRM’s notification, the calls, the write, the bells and what each site applied."
          flush
        >
          <EventTable
            events={d.timeline}
            empty="Nothing in the log for this record."
            onCorrelation={(correlation) =>
              navigate(`/events?correlation=${encodeURIComponent(correlation)}`)
            }
          />
        </Section>
      </div>
    </>
  );
}
