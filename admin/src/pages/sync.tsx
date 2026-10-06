// Manual sync (Patric, 2026-10-06, built from zero beside the old page): its purpose is to fetch
// data again. One scope, then how far to go: fetch from the CRM, recompute and send to the sites;
// recompute and send; or send only. Each level does its own step and every step after it, and the
// full one is the default. What the run does shows below in the Flow list, the same component as
// the Flow page, scoped to the run.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useCustomMutation, useList } from '@refinedev/core';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Confirm } from '@/components/confirm';
import { FlowList } from '@/components/flow';
import { PageHeader } from '@/components/layout';
import { ScopePicker, useScopeOptions } from '@/components/scope-picker';
import { counted } from '@/lib/format';
import { readScope, sayScope, scopeBody, scopeQuery, writeScope } from '@/lib/scope';

type Level = 'fetch' | 'recompute' | 'send';

/** The three levels, the full one first; each is a step short of the one above it. */
const LEVELS: { level: Level; label: string; does: string }[] = [
  {
    level: 'fetch',
    label: 'Fetch from the CRM, recompute and send to the sites',
    does: 'Core asks the CRM for the records again, computes them again from the rules, and sends them to the sites. With only tenants or entity types picked, Core reads the CRM’s whole list, so a record the CRM no longer lists also leaves the sites. The CRM is called.',
  },
  {
    level: 'recompute',
    label: 'Recompute and send to the sites',
    does: 'Core computes the records again from what it already holds, and sends them to the sites. No CRM is called.',
  },
  {
    level: 'send',
    label: 'Send to the sites only',
    does: 'Core sends the records as they are to every site of their tenants. A site takes the ones it lacks or holds in another version, and leaves the rest as they are. Nothing is fetched or computed.',
  },
];

export function ManualSyncPage() {
  const [params, setParams] = useSearchParams();
  const [level, setLevel] = useState<Level>('fetch');
  const options = useScopeOptions();
  const scope = readScope(params);
  const { mutateAsync } = useCustomMutation();
  // How many live records the scope holds: one page of one row, for its total.
  const { result } = useList({
    resource: 'records',
    pagination: { currentPage: 1, pageSize: 1 },
    filters: Object.entries({ ...scopeQuery(scope), deleted: 'false' }).map(([field, value]) => ({
      field,
      operator: 'eq' as const,
      value,
    })),
  });
  const total = result?.total;
  const said = sayScope(scope, options);
  const chosen = LEVELS.find((one) => one.level === level) ?? LEVELS[0];
  const covers =
    total === undefined ? said : `${said}: ${counted(total, 'live record', 'live records')} now`;

  const start = async (): Promise<void> => {
    try {
      const answer = await mutateAsync({
        url: '/runs/sync',
        method: 'post',
        values: { level, ...scopeBody(scope) },
        successNotification: false,
        errorNotification: false,
      });
      toast.success((answer.data as unknown as { detail: string }).detail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <PageHeader
        title="Manual sync"
        what="Fetch records from the CRM again and bring them to the sites. Pick what, pick how far to go, start, and watch it below."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>What to sync</CardTitle>
          <CardDescription>
            A box left empty takes every tenant, office or entity type. The offices offered are
            those of the tenants ticked. A record’s CRM id takes that one record only.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ScopePicker
              value={scope}
              onChange={(next) => setParams(writeScope(params, next), { replace: true })}
              options={options}
            />
          </div>
          <p className="text-sm" data-testid="covers">
            This covers {covers}.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>How far to go</CardTitle>
          <CardDescription>Each level does its own step and every step below it.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">How far to go</legend>
            {LEVELS.map((one) => (
              <label key={one.level} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="level"
                  className="mt-1"
                  checked={level === one.level}
                  onChange={() => setLevel(one.level)}
                />
                <span>
                  <span className="font-medium">{one.label}</span>
                  <span className="block text-muted-foreground">{one.does}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <Confirm
              label="Start"
              title={chosen?.label ?? ''}
              what={`${chosen?.does ?? ''} It covers ${covers}.`}
              confirmLabel="Start it"
              onConfirm={start}
            />
            <span className="text-sm text-muted-foreground">
              Starts the level picked for this scope, after saying what will happen.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Records on their way</CardTitle>
          <CardDescription>
            The records picked above on their way from the CRM to the sites, newest first. A record
            waits for the CRM, then is in Core, then is on a site. The list is read again every
            second.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FlowList scope={scope} options={options} />
        </CardContent>
      </Card>
    </>
  );
}
