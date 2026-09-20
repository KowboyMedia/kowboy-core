// An adapter's page: its setup directions and settings, then what it knows and can do, all
// described by the adapter as data and drawn here.
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { AdminAction, ProviderPage as ProviderData } from '@/api/types';
import { PageHeader, Section } from '@/components/page';
import { Sections, Value } from '@/components/sections';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ProviderPage() {
  const { provider = '' } = useParams();
  const client = useQueryClient();
  const page = useQuery({
    queryKey: ['provider', provider],
    queryFn: () => api<ProviderData>(`/v1/admin/providers/${encodeURIComponent(provider)}`),
    refetchInterval: 15_000,
  });
  const run = async (
    action: AdminAction,
    params: Record<string, string>,
  ): Promise<{ message: string }> => {
    const result = await api<{ message: string }>(
      `/v1/admin/providers/${encodeURIComponent(provider)}/actions`,
      { body: { action: action.id, params } },
    );
    void client.invalidateQueries({ queryKey: ['provider', provider] });
    return result;
  };
  if (page.isPending) return <Skeleton className="h-64" />;
  if (page.error) return <p className="text-bad">{page.error.message}</p>;
  const d = page.data;
  return (
    <>
      <PageHeader
        eyebrow="CRM adapter"
        title={d.provider}
        intro={`Everything about the link to ${d.provider}: how to set it up, its settings as they are, and what the adapter knows and can do.`}
      />
      <div className="flex flex-col gap-4">
        <Section
          title={`Set up ${d.provider}`}
          help="How a customer’s account gets onto Core, in order. The settings are the app’s environment, set at deploy; everything else happens on the panel."
        >
          <ol className="flex flex-col gap-3">
            {d.directions.steps.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-2 text-sm">
                <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <div className="font-medium">{step.title}</div>
                  <p className="text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <h3 className="mt-5 mb-2 text-sm font-semibold">Settings</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setting</TableHead>
                  <TableHead>Now</TableHead>
                  <TableHead>What it does</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.directions.settings.map((setting) => (
                  <TableRow key={setting.key} data-setting={setting.key}>
                    <TableCell className="font-mono text-xs">{setting.key}</TableCell>
                    <TableCell>
                      <Value value={setting.value} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{setting.help}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
        <Sections sections={d.sections} run={run} />
      </div>
    </>
  );
}
