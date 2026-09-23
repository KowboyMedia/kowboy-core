// Settings (U6, U7): what this Core is configured with, what the database holds, which versions
// are running, where alerts go, who may sign in, and the maintenance switch. A setting's value is
// never shown — only whether it is set — so a screen share never leaks one.
import { useCustom, useCustomMutation, useList } from '@refinedev/core';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Confirm } from '@/components/confirm';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { useLive } from '@/lib/live';
import { moment } from '@/lib/format';

type Configuration = {
  environment: string;
  version: string;
  startedAt: string;
  rulesVersion: string;
  schemaVersion: string;
  publicUrl: string | null;
  eventRetentionDays: number;
  bellThrottleMs: number;
  set: { key: string; set: boolean; what: string }[];
  alerts: { email: string | null; slack: boolean; mail: boolean };
  people: string[];
  peopleDomains: string[];
  migrations: string[];
  maintenance: boolean;
  switches: { key: string; value: string; updated_at: string; updated_by: string | null }[];
};

type DeviceRow = {
  device: string | null;
  remembered: boolean;
  current: boolean;
  signedInAt: string;
  lastSeenAt: string;
  until: string;
};

export function SettingsPage() {
  const { result, query } = useCustom<Configuration>({ url: '/settings', method: 'get' });
  const { result: deviceList, query: deviceQuery } = useList<DeviceRow>({
    resource: 'devices',
    pagination: { mode: 'off' },
  });
  const devices = deviceList?.data ?? [];
  const refetchDevices = deviceQuery.refetch;
  const { mutateAsync } = useCustomMutation();
  useLive('settings', query.refetch);
  // An answer that has not arrived is an empty object, so the page tests a field it needs.
  const config = result?.data?.version ? result.data : null;

  const setMaintenance = async (on: boolean): Promise<void> => {
    try {
      await mutateAsync({
        url: '/settings/maintenance',
        method: 'post',
        values: { on },
        successNotification: false,
        errorNotification: false,
      });
      await query.refetch();
      toast.success(on ? 'Maintenance is on.' : 'Maintenance is off; the held bells go out now.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  if (query.isLoading || !config) {
    return <p className="text-sm text-muted-foreground">Looking…</p>;
  }

  return (
    <>
      <PageHeader
        title="Settings"
        what="How this Core is configured, and the one switch that pauses its own work."
      >
        <Badge tone={config.environment === 'production' ? 'bad' : 'warn'}>
          {config.environment}
        </Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="maintenance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Maintenance
              <Badge tone={config.maintenance ? 'warn' : 'ok'}>
                {config.maintenance ? 'on' : 'off'}
              </Badge>
            </CardTitle>
            <CardDescription>
              While it is on, the sites still pull exactly as before — nothing a visitor sees
              changes — but Core rings no site and takes no job. Changes meanwhile are remembered
              and go out in one round when it is turned off.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config.maintenance ? (
              <Confirm
                label="Turn maintenance off"
                title="Turn maintenance off"
                what="Core rings the sites it held back and starts taking jobs again."
                confirmLabel="Turn it off"
                variant="secondary"
                onConfirm={() => setMaintenance(false)}
              />
            ) : (
              <Confirm
                label="Turn maintenance on"
                title="Turn maintenance on"
                what="Core stops ringing sites and stops taking jobs until you turn this off. The sites keep pulling on their own schedule, so nothing a visitor sees changes."
                confirmLabel="Turn it on"
                onConfirm={() => setMaintenance(true)}
              />
            )}
            {config.switches.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {config.switches
                  .map(
                    (row) =>
                      `${row.key} is ${row.value}, set ${moment(row.updated_at)}${row.updated_by ? ` by ${row.updated_by}` : ''}`,
                  )
                  .join(' · ')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What is running</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[minmax(0,12rem)_1fr] gap-y-1 text-sm">
              <dt className="text-muted-foreground">Version</dt>
              <dd>{config.version}</dd>
              <dt className="text-muted-foreground">Running since</dt>
              <dd className="tabular-nums">{moment(config.startedAt)}</dd>
              <dt className="text-muted-foreground">Rules version</dt>
              <dd>{config.rulesVersion}</dd>
              <dt className="text-muted-foreground">Contract version</dt>
              <dd>{config.schemaVersion}</dd>
              <dt className="text-muted-foreground">Reached at</dt>
              <dd>{config.publicUrl ?? 'not set'}</dd>
              <dt className="text-muted-foreground">Events kept</dt>
              <dd>{config.eventRetentionDays} days</dd>
              <dt className="text-muted-foreground">Bells at most every</dt>
              <dd>{config.bellThrottleMs} ms</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What is configured</CardTitle>
            <CardDescription>
              Whether each setting has a value, never the value itself.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {config.set.map((row) => (
                <li key={row.key} className="flex items-start justify-between gap-3">
                  <span>
                    <code className="text-xs">{row.key}</code>
                    <span className="block text-xs text-muted-foreground">{row.what}</span>
                  </span>
                  <Badge tone={row.set ? 'ok' : 'muted'}>{row.set ? 'set' : 'not set'}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerts and access</CardTitle>
            <CardDescription>
              Where Core tells someone a check went red, and who may open this area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[minmax(0,12rem)_1fr] gap-y-1 text-sm">
              <dt className="text-muted-foreground">By mail to</dt>
              <dd>
                {config.alerts.email ?? 'nobody'}
                {config.alerts.email && !config.alerts.mail && (
                  <span className="text-danger"> — but Core cannot send mail</span>
                )}
              </dd>
              <dt className="text-muted-foreground">To Slack</dt>
              <dd>{config.alerts.slack ? 'yes' : 'no'}</dd>
              <dt className="text-muted-foreground">Who may sign in</dt>
              <dd>
                {[
                  ...config.people,
                  ...config.peopleDomains.map((domain) => `anyone at ${domain}`),
                ].join(', ') || 'nobody: neither ADMIN_EMAILS nor ADMIN_EMAIL_DOMAINS is set'}
                <span className="block text-xs text-muted-foreground">
                  The sign-in page says the same thing to every address, so it never gives this
                  away.
                </span>
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your devices</CardTitle>
            <CardDescription>
              Where you are signed in. A device you asked to be remembered stays signed in for 30
              days; any other for 14. Each device is its own, so signing out here leaves the rest
              alone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  key: 'device',
                  header: 'Device',
                  cell: (row) => (
                    <span className="break-all">
                      {row.device ?? 'a browser that did not say'}
                      {row.current && (
                        <Badge tone="ok" className="ml-2">
                          this one
                        </Badge>
                      )}
                    </span>
                  ),
                },
                {
                  key: 'remembered',
                  header: 'Remembered',
                  cell: (row) => (
                    <Badge tone={row.remembered ? 'ok' : 'muted'}>
                      {row.remembered ? '30 days' : '14 days'}
                    </Badge>
                  ),
                },
                {
                  key: 'lastSeen',
                  header: 'Last used',
                  cell: (row) => <span className="tabular-nums">{moment(row.lastSeenAt)}</span>,
                },
                {
                  key: 'until',
                  header: 'Signed in until',
                  cell: (row) => <span className="tabular-nums">{moment(row.until)}</span>,
                },
              ]}
              rows={devices}
              rowKey={(row) => `${row.signedInAt}|${row.device ?? ''}`}
              empty={<Empty what="Only this one." />}
            />
            {devices.length > 1 && (
              <div className="mt-3">
                <Confirm
                  label="Sign out everywhere else"
                  title="Sign out of the other devices"
                  what={`The other ${String(devices.length - 1)} device(s) are signed out at once and will need a new link. This one stays signed in.`}
                  confirmLabel="Sign the others out"
                  onConfirm={async () => {
                    await mutateAsync({
                      url: '/devices/forget-others',
                      method: 'post',
                      values: {},
                      successNotification: false,
                      errorNotification: false,
                    });
                    await refetchDevices();
                    toast.success('The other devices are signed out.');
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>What the database holds</CardTitle>
            <CardDescription>
              Every migration applied, in order. Core refuses to serve if the database is ahead of
              it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-1">
              {config.migrations.map((migration) => (
                <li key={migration}>
                  <Badge tone="neutral">{migration}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
