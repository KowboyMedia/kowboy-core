// Settings: how this Core is set up, read-only from the environment; the start-over point per
// tenant in plain words; housekeeping now; the CRMs Core ships.
import { Link } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, messageOf } from '@/api/client';
import type { Settings } from '@/api/types';
import { PageHeader, Section } from '@/components/page';
import { YesNo } from '@/components/state-badge';
import { Button } from '@/components/ui/button';
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

export function SettingsPage() {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<Settings>('/v1/admin/settings'),
  });
  const housekeeping = useMutation({
    mutationFn: () =>
      api<{ events: number; tombstones: number }>('/v1/admin/housekeeping', { body: {} }),
    onSuccess: ({ events, tombstones }) =>
      toast.success(
        `Housekeeping done: ${fmtNumber(events)} event(s) and ${fmtNumber(tombstones)} removed record(s) deleted.`,
      ),
    onError: (error) => toast.error(messageOf(error)),
  });
  if (settings.isPending) return <Skeleton className="h-64" />;
  if (settings.error) return <p className="text-bad">{settings.error.message}</p>;
  const s = settings.data;
  return (
    <>
      <PageHeader
        title="Settings"
        intro="How this Core is set up. The values come from the environment the app runs in, so they are read-only here; an agent changes them."
      />
      <div className="flex flex-col gap-4">
        <Section title="Configuration" help="Every setting, its value, and what it does." flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Setting</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="pr-5">What it does</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.settings.map((row) => (
                <TableRow key={row.key} data-setting={row.key}>
                  <TableCell className="pl-5 font-medium whitespace-nowrap">{row.key}</TableCell>
                  <TableCell className="font-mono text-xs break-all">{String(row.value)}</TableCell>
                  <TableCell className="pr-5 text-muted-foreground">{row.help}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section
          title="CRM adapters"
          help="The CRMs Core ships; each has a page with its directions, settings and what it knows."
          flush
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">CRM</TableHead>
                <TableHead>Login fields</TableHead>
                <TableHead className="pr-5">Can</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.providers.map((provider) => (
                <TableRow key={provider.provider}>
                  <TableCell className="pl-5">
                    <Link to={`/crm/${provider.provider}`} className="text-primary hover:underline">
                      {provider.provider}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {provider.credentials.map((field) => field.label).join(', ') || 'none'}
                  </TableCell>
                  <TableCell className="pr-5 text-muted-foreground">
                    {[
                      provider.can.probe && 'check a login',
                      provider.can.inspect && 'look at a record',
                      provider.can.queue && 'show its queue',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'nothing beyond the basics'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section
          title="Start-over point per tenant"
          help="When a record is deleted, Core keeps a marker for 90 days so that every site hears about the deletion at its next pull; then the marker is removed for good. The number here is the position up to which markers are gone. A site whose last pull lies before that point would miss deletions, so Core tells it to pull everything again. The point moves only when housekeeping removes old markers, so it affects only a site that has not pulled for 90 days."
          flush
        >
          {s.startOver.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground">No tenants yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Tenant</TableHead>
                  <TableHead>Start-over point</TableHead>
                  <TableHead className="pr-5">Licence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.startOver.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="pl-5">
                      <Link to={`/tenants/${tenant.id}`} className="text-primary hover:underline">
                        #{tenant.id} {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{fmtNumber(tenant.watermark)}</TableCell>
                    <TableCell className="pr-5">
                      <YesNo value={tenant.active} yes="active" no="disabled" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
        <Section
          title="Housekeeping"
          help="Deletes events past their retention and removed records past theirs. The worker does this every hour; this runs it now."
          actions={
            <Button onClick={() => housekeeping.mutate()} disabled={housekeeping.isPending}>
              Run housekeeping now
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">
            Nothing a site still needs is touched: a removed record stays its full 90 days.
          </p>
        </Section>
      </div>
    </>
  );
}
