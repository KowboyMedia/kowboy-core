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
import { Explained } from '@/components/explained';
import { PageHeader } from '@/components/layout';
import { useLive } from '@/lib/live';
import { counted, lasting, moment } from '@/lib/format';

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
      toast.success(
        on
          ? 'Maintenance is on. Core holds back its own work until you turn it off.'
          : 'Maintenance is off. Core tells the sites about the changes it held back.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  if (query.isLoading || !config) {
    return <p className="text-sm text-muted-foreground">Looking…</p>;
  }
  const switched = config.switches.find((row) => row.key === 'maintenance');
  const others = devices.length - 1;

  return (
    <>
      <PageHeader
        title="Settings"
        what="How this Core is set up: what is running, which server settings have a value, where alerts go and who may sign in. Maintenance holds back Core’s own work while Core is being worked on."
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
                {config.maintenance ? 'On' : 'Off'}
              </Badge>
            </CardTitle>
            <CardDescription>
              While maintenance is on, Core tells no site about changes and runs no recompute. The
              sites keep fetching on their own schedule, so visitors see no break, only later
              updates. When it is turned off, Core tells each site at once about what changed
              meanwhile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {config.maintenance ? (
              <Explained what="Tells each site at once about the changes held back, and runs recomputes again. Press it when the work on Core is done.">
                <Confirm
                  label="Turn maintenance off"
                  title="Turn maintenance off"
                  what="Core tells each site about the changes it held back, and runs recomputes again."
                  confirmLabel="Turn it off"
                  variant="secondary"
                  onConfirm={() => setMaintenance(false)}
                />
              </Explained>
            ) : (
              <Explained what="Holds back Core’s own work until you turn maintenance off. Press it while Core’s server or database is being worked on.">
                <Confirm
                  label="Turn maintenance on"
                  title="Turn maintenance on"
                  what="Core stops telling the sites about changes and stops running recomputes until you turn maintenance off. The sites keep fetching on their own schedule, so visitors see no break."
                  confirmLabel="Turn it on"
                  onConfirm={() => setMaintenance(true)}
                />
              </Explained>
            )}
            {switched && (
              <p className="mt-3 text-xs text-muted-foreground">
                Last turned {switched.value} {moment(switched.updated_at)}
                {switched.updated_by ? ` by ${switched.updated_by}` : ''}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What is running</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[minmax(0,14rem)_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Core’s version</dt>
              <dd>{config.version}</dd>
              <dt className="text-muted-foreground">Running since</dt>
              <dd className="tabular-nums">{moment(config.startedAt)}</dd>
              <dt className="text-muted-foreground">The rules that make the texts</dt>
              <dd>Version {config.rulesVersion}</dd>
              <dt className="text-muted-foreground">What the sites receive</dt>
              <dd>Version {config.schemaVersion}</dd>
              <dt className="text-muted-foreground">Core’s address</dt>
              <dd>{config.publicUrl ?? 'Not set'}</dd>
              <dt className="text-muted-foreground">The event log keeps</dt>
              <dd>{counted(config.eventRetentionDays, 'day', 'days')}</dd>
              <dt className="text-muted-foreground">A site is told of changes</dt>
              <dd>
                {config.bellThrottleMs < 1000
                  ? 'As soon as something changes'
                  : `At most once every ${lasting(config.bellThrottleMs)}`}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Server settings</CardTitle>
            <CardDescription>
              Whether each of Core’s server settings has a value, never the value itself. They are
              set where Core’s server runs, under the names shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {config.set.map((row) => (
                <li key={row.key} className="flex items-start justify-between gap-3">
                  <span>
                    {row.what}
                    <code className="block text-xs text-muted-foreground">{row.key}</code>
                  </span>
                  <Badge tone={row.set ? 'ok' : 'muted'}>{row.set ? 'Set' : 'Not set'}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerts and access</CardTitle>
            <CardDescription>
              Where Core sends an alert when something needs attention, and who may sign in here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[minmax(0,12rem)_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Alerts by mail to</dt>
              <dd>
                {config.alerts.email ?? 'Nobody: the server setting ALERT_EMAIL is not set.'}
                {config.alerts.email && !config.alerts.mail && (
                  <span className="block text-danger">
                    Core cannot send mail, so no alert reaches this address: the server setting
                    POSTMARK_SERVER_TOKEN or MAIL_FROM is not set.
                  </span>
                )}
              </dd>
              <dt className="text-muted-foreground">Alerts to Slack</dt>
              <dd>
                {config.alerts.slack
                  ? 'Yes'
                  : 'No: the server setting ALERT_SLACK_WEBHOOK_URL is not set.'}
              </dd>
              <dt className="text-muted-foreground">Who may sign in</dt>
              <dd>
                {[
                  ...config.people,
                  ...config.peopleDomains.map((domain) => `anyone at ${domain}`),
                ].join(', ') ||
                  'Nobody yet: set the server setting ADMIN_EMAILS or ADMIN_EMAIL_DOMAINS.'}
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
                      {row.device ?? 'A browser that gave no name'}
                      {row.current && (
                        <Badge tone="ok" className="ml-2">
                          This one
                        </Badge>
                      )}
                    </span>
                  ),
                },
                {
                  key: 'remembered',
                  header: 'Stays signed in',
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
              empty={<Empty what="Only this device is signed in." />}
            />
            {others > 0 && (
              <div className="mt-3">
                <Explained what="Signs you out at once on every other device, which then needs a new link to get in. Press it when a device you signed in on may be lost or used by someone else.">
                  <Confirm
                    label="Sign out everywhere else"
                    title="Sign out of the other devices"
                    what={`${others === 1 ? 'The other device is signed out at once and needs' : `The other ${counted(others, 'device', 'devices')} are signed out at once and need`} a new link to get in. This one stays signed in.`}
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
                </Explained>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Changes to the database’s layout</CardTitle>
            <CardDescription>
              A new version of Core changes how its database is laid out when it starts. Core does
              not start on a database that holds a change it does not know, so an older Core never
              runs on a newer database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Core has made {counted(config.migrations.length, 'change', 'changes')} to this
              database’s layout so far.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
