// The actions every page offers on a scope: a recompute (always a preview first, the job page
// runs it for real), a fetch again from the CRM, and a bell to a tenant's sites.
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellIcon, PlayIcon, RefreshCwIcon } from 'lucide-react';
import { api, messageOf } from '@/api/client';
import type { Scope } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Confirm } from '@/components/confirm';

/** A scope in words: "everything", "tenant #3", "3 selected records". */
export function describeScope(scope: Scope): string {
  const parts: string[] = [];
  if (scope.keys)
    parts.push(`${scope.keys.length} selected record${scope.keys.length === 1 ? '' : 's'}`);
  if (scope.provider) parts.push(`the CRM ${scope.provider}`);
  if (scope.tenantId) parts.push(`tenant #${scope.tenantId}`);
  if (scope.connectionId) parts.push(`connection ${scope.connectionId}`);
  if (scope.officeId) parts.push(`office ${scope.officeId}`);
  if (scope.datatype) parts.push(`datatype ${scope.datatype}`);
  if (scope.remoteId) parts.push(`record ${scope.remoteId}`);
  if (scope.staleRulesOnly) parts.push('only records of an older rules version');
  return parts.length === 0 ? 'everything' : parts.join(', ');
}

/** Queues a preview of a recompute and opens the job. */
export function PreviewButton({
  scope,
  label = 'Preview recompute',
  disabled,
  variant = 'outline',
  size = 'sm',
}: {
  scope: Scope;
  label?: string;
  disabled?: boolean;
  variant?: 'outline' | 'default';
  size?: 'sm' | 'default';
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const start = useMutation({
    mutationFn: () =>
      api<{ id: number }>('/v1/admin/jobs', { body: { kind: 'recompute', scope, dryRun: true } }),
    onSuccess: ({ id }) => {
      void client.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(`Preview #${id} is queued: ${describeScope(scope)}.`);
      navigate(`/jobs/${id}`);
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || start.isPending}
      onClick={() => start.mutate()}
      data-testid="preview"
    >
      <PlayIcon /> {label}
    </Button>
  );
}

/** Queues a fetch again from the CRM for a scope, or for named records. */
export function RefetchButton({
  scope,
  records,
  label = 'Fetch again from the CRM',
  disabled,
  size = 'sm',
}: {
  scope: Scope;
  records?: { datatype: string; remoteId: string; officeId: string | null }[];
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
}) {
  const client = useQueryClient();
  const run = useMutation({
    mutationFn: () =>
      api<{ queued: { connectionId: string; event: string; records?: number }[] }>(
        '/v1/admin/refetch',
        { body: { scope, records } },
      ),
    onSuccess: ({ queued }) => {
      void client.invalidateQueries({ queryKey: ['activity'] });
      toast.success(
        `Queued for ${queued.length} connection${queued.length === 1 ? '' : 's'}: ${queued.map((q) => `${q.event}${q.records ? ` (${q.records})` : ''}`).join(', ')}. The worker hands it to the adapter within seconds.`,
      );
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const wide = !scope.keys && !scope.remoteId && !records;
  const button = (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={disabled || run.isPending}
      onClick={wide ? undefined : () => run.mutate()}
      data-testid="refetch"
    >
      <RefreshCwIcon /> {label}
    </Button>
  );
  if (!wide) return button;
  return (
    <Confirm
      title="Fetch again from the CRM"
      description={`Every connection in ${describeScope(scope)} lists its records at the CRM again, fetches them, and removes from the sites what is no longer listed. It costs CRM calls; the sites are rung when records change.`}
      action="Fetch again"
      onConfirm={() => run.mutateAsync().then(() => undefined)}
    >
      {button}
    </Confirm>
  );
}

/** Rings a tenant's sites, or one of them. */
export function RingButton({
  tenantId,
  site,
  kind = 'delta',
  label,
  size = 'sm',
}: {
  tenantId: number;
  site?: number;
  kind?: 'delta' | 'forcerefresh';
  label?: string;
  size?: 'sm' | 'default';
}) {
  const run = useMutation({
    mutationFn: () => api(`/v1/admin/tenants/${tenantId}/ring`, { body: { kind, site } }),
    onSuccess: () =>
      toast.success(
        kind === 'delta'
          ? 'Rung: the sites pull what changed.'
          : 'Rung: the sites pull everything again.',
      ),
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={run.isPending}
      onClick={() => run.mutate()}
    >
      <BellIcon /> {label ?? (kind === 'delta' ? 'Ring: pull changes' : 'Ring: pull everything')}
    </Button>
  );
}
