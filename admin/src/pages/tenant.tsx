// One tenant, one page, one Save (§3 A, Must; Patric's rule 1). Making a tenant and changing one
// are the same page: name, licence, its CRM connections with their logins and offices, and its
// sites. Nothing reloads; every outcome is a toast; every dangerous button is red and asks first.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useCustomMutation, useList, useOne } from '@refinedev/core';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { AdapterSections, type AdminSection } from '@/components/adapter-sections';
import { Confirm } from '@/components/confirm';
import { Copy } from '@/components/copy';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { ago, count, moment } from '@/lib/format';

type CrmSummary = {
  provider: string;
  credentials: {
    key: string;
    label: string;
    secret?: boolean;
    help?: string;
    required?: boolean;
  }[];
};

type ConnectionView = {
  id: string;
  provider: string;
  licensedOffices: string[];
  active: boolean;
  hasCredentials: boolean;
  lastIngestAt: string | null;
  lastError: string | null;
  loaded: { datatype: string; live: number }[];
  sections: AdminSection[];
};

type SiteView = {
  id: number;
  label: string;
  bellUrl: string;
  bellSecret: string;
  active: boolean;
  lastPullAt: string | null;
  lastBellAt: string | null;
  lastBellStatus: string | null;
  lastClient: string | null;
  checklist: { step: string; done: boolean; detail: string }[];
  applied: { applied: number; failed: number };
  errors: { at: string; message: string; where: string; detail: string | null }[];
};

type TenantView = {
  id: number;
  displayName: string;
  active: boolean;
  token: string | null;
  createdAt: string;
  connections: ConnectionView[];
  sites: SiteView[];
  records: { datatype: string; live: number; tombstoned: number }[];
};

/** The form's own shape: what the page holds while a person is typing. */
type ConnectionForm = {
  id: string;
  provider: string;
  credentials: Record<string, string>;
  offices: string;
  active: boolean;
};
type SiteForm = { id?: number; label: string; bellUrl: string; active: boolean };
type Form = {
  displayName: string;
  active: boolean;
  connections: ConnectionForm[];
  sites: SiteForm[];
};

const EMPTY: Form = { displayName: '', active: true, connections: [], sites: [] };

const toForm = (tenant: TenantView): Form => ({
  displayName: tenant.displayName,
  active: tenant.active,
  connections: tenant.connections.map((connection) => ({
    id: connection.id,
    provider: connection.provider,
    credentials: {},
    offices: connection.licensedOffices.join(', '),
    active: connection.active,
  })),
  sites: tenant.sites.map((site) => ({
    id: site.id,
    label: site.label,
    bellUrl: site.bellUrl,
    active: site.active,
  })),
});

const offices = (value: string): string[] =>
  value
    .split(',')
    .map((office) => office.trim())
    .filter(Boolean);

/** What the page will not send, said at the field it belongs to (§3 A, Must). */
function problems(form: Form): Record<string, string> {
  const found: Record<string, string> = {};
  if (form.displayName.trim() === '') found['displayName'] = 'A tenant needs a name.';
  form.connections.forEach((connection, index) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(connection.id)) {
      found[`connection-${String(index)}`] =
        'Short name: lower-case letters, digits and dashes, starting with a letter or a digit.';
    } else if (!connection.provider) {
      found[`connection-${String(index)}`] = 'Choose the CRM this connection reads.';
    }
  });
  form.sites.forEach((site, index) => {
    if (site.label.trim() === '') found[`site-${String(index)}`] = 'A site needs a name.';
    else if (!/^https?:\/\/.+/.test(site.bellUrl)) {
      found[`site-${String(index)}`] = 'The bell address starts with http:// or https://.';
    }
  });
  return found;
}

export function TenantPage() {
  const { id } = useParams();
  const making = id === undefined;
  const navigate = useNavigate();
  const { mutateAsync } = useCustomMutation();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const { result, query } = useOne<TenantView>({
    resource: 'tenants',
    id: id ?? '',
    queryOptions: { enabled: !making },
  });
  // An answer that has not arrived is an empty object, so the page tests a field it needs.
  const tenant = making || !result?.id ? null : result;

  const { result: crmList } = useList<CrmSummary>({
    resource: 'crms',
    pagination: { mode: 'off' },
  });
  const crms = useMemo(() => crmList?.data ?? [], [crmList]);

  useEffect(() => {
    if (tenant) setForm(toForm(tenant));
  }, [tenant]);

  const found = problems(form);
  const problem = (key: string): string | undefined => (touched ? found[key] : undefined);

  const post = async <T,>(
    url: string,
    values: object = {},
    method: 'post' | 'patch' = 'post',
  ): Promise<T> => {
    const answer = await mutateAsync({
      url,
      method,
      values,
      successNotification: false,
      errorNotification: false,
    });
    return answer.data as unknown as T;
  };

  const save = async (): Promise<void> => {
    setTouched(true);
    if (Object.keys(found).length > 0) {
      toast.error('Some fields need fixing first.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        displayName: form.displayName.trim(),
        active: form.active,
        connections: form.connections.map((connection) => ({
          id: connection.id,
          provider: connection.provider,
          credentials: connection.credentials,
          licensedOffices: offices(connection.offices),
          active: connection.active,
        })),
        sites: form.sites.map((site) => ({
          ...(site.id === undefined ? {} : { id: site.id }),
          label: site.label.trim(),
          bellUrl: site.bellUrl.trim(),
          active: site.active,
        })),
      };
      const saved = making
        ? await post<TenantView & { changes: string[] }>('/tenants', body)
        : await post<TenantView & { changes: string[] }>(`/tenants/${id ?? ''}`, body, 'patch');
      toast.success('Saved', { description: saved.changes.join('; ') });
      if (making) void navigate(`/tenants/${String(saved.id)}`, { replace: true });
      else await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const tryLogin = async (connection: ConnectionForm): Promise<void> => {
    try {
      const outcome = await post<{ ok: boolean; detail: string }>(
        `/crms/${connection.provider}/probe`,
        { credentials: connection.credentials, officeIds: offices(connection.offices) },
      );
      if (outcome.ok) toast.success('The CRM answered', { description: outcome.detail });
      else toast.error('The CRM refused', { description: outcome.detail });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const runAdapterAction = async (
    provider: string,
    action: { id: string },
    params: Record<string, string>,
  ): Promise<{ message: string }> => post(`/crms/${provider}/act`, { action: action.id, params });

  if (!making && query.isLoading) return <p className="text-sm text-muted-foreground">Looking…</p>;
  if (!making && !tenant) {
    return (
      <Empty
        what="There is no such tenant."
        next={
          <Button asChild size="sm">
            <Link to="/tenants">Back to the tenants</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={making ? 'New tenant' : (tenant?.displayName ?? '')}
        what={
          making
            ? 'Name it, give it a CRM login and the offices it may see, and add the sites that will show its listings. One Save does all of it.'
            : `Tenant ${String(tenant?.id ?? '')}, made ${moment(tenant?.createdAt ?? null)}.`
        }
      >
        <Button onClick={() => void save()} disabled={saving} data-testid="save">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {!making && (
          <Confirm
            label="Remove everything"
            title={`Remove ${tenant?.displayName ?? ''}`}
            what="The tenant, its CRM connections, its sites, every record Core holds for it and its whole history in the event log are deleted. Its sites keep what they already show until someone takes the plugin off them. This cannot be undone."
            confirmLabel="Remove it all"
            onConfirm={async () => {
              await mutateAsync({
                url: `/tenants/${id ?? ''}`,
                method: 'delete',
                values: {},
                successNotification: false,
                errorNotification: false,
              });
              toast.success('Removed.');
              void navigate('/tenants');
            }}
          />
        )}
      </PageHeader>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>The customer</CardTitle>
          <CardDescription>
            Its name, whether its licence is on, and the token its sites pull with.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              value={form.displayName}
              aria-invalid={problem('displayName') !== undefined}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Acme Mäklare"
            />
            {problem('displayName') && (
              <p className="text-sm text-danger">{problem('displayName')}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="active">Licence</Label>
            <Select
              id="active"
              value={form.active ? 'on' : 'off'}
              onChange={(event) => setForm({ ...form, active: event.target.value === 'on' })}
            >
              <option value="on">on — its sites are rung and may pull</option>
              <option value="off">off — its sites keep what they show and pull nothing</option>
            </Select>
          </div>
          {!making && (
            <div className="md:col-span-2">
              <Label>The token its sites pull with</Label>
              {tenant?.token ? (
                <Copy value={tenant.token} label="tenant token" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  This tenant was made before tokens were kept readable. Give it a new one to see
                  it.
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Confirm
                  label="New token"
                  title="Give this tenant a new token"
                  what="Every site of this tenant stops syncing the moment the new token exists, until the new value is pasted into each of them. Nothing already on a site disappears."
                  confirmLabel="Make a new token"
                  size="sm"
                  onConfirm={async () => {
                    await post(`/tenants/${id ?? ''}/token`);
                    await query.refetch();
                    toast.success('New token. Paste it into each site.');
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void post(`/tenants/${id ?? ''}/ring`)
                      .then(() => toast.success('Rang every site of this tenant.'))
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : String(error)),
                      )
                  }
                >
                  Ring its sites
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Its CRM connections</CardTitle>
          <CardDescription>
            One or several, of the same CRM or different ones. A connection is a setting of this
            tenant: it has no page of its own.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {form.connections.length === 0 && (
            <Empty what="No CRM yet. Add one and Core starts loading its records as soon as you save." />
          )}
          {form.connections.map((connection, index) => {
            const crm = crms.find((one) => one.provider === connection.provider);
            const saved = tenant?.connections.find((one) => one.id === connection.id);
            const change = (patch: Partial<ConnectionForm>): void => {
              const next = [...form.connections];
              next[index] = { ...connection, ...patch };
              setForm({ ...form, connections: next });
            };
            return (
              <div key={index} className="rounded-lg border p-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`connection-id-${String(index)}`}>Short name</Label>
                    <Input
                      id={`connection-id-${String(index)}`}
                      value={connection.id}
                      disabled={saved !== undefined}
                      aria-invalid={problem(`connection-${String(index)}`) !== undefined}
                      onChange={(event) => change({ id: event.target.value })}
                      placeholder="acme-crm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`connection-provider-${String(index)}`}>CRM</Label>
                    <Select
                      id={`connection-provider-${String(index)}`}
                      value={connection.provider}
                      disabled={saved !== undefined}
                      onChange={(event) =>
                        change({ provider: event.target.value, credentials: {} })
                      }
                    >
                      <option value="">choose a CRM</option>
                      {crms.map((one) => (
                        <option key={one.provider} value={one.provider}>
                          {one.provider}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`connection-offices-${String(index)}`}>
                      Offices it may see
                    </Label>
                    <Input
                      id={`connection-offices-${String(index)}`}
                      value={connection.offices}
                      onChange={(event) => change({ offices: event.target.value })}
                      placeholder="M31529, M31530"
                    />
                    <p className="text-xs text-muted-foreground">
                      Separated by commas. Empty means every office the login can see.
                    </p>
                  </div>
                </div>

                {problem(`connection-${String(index)}`) && (
                  <p className="mt-2 text-sm text-danger">
                    {problem(`connection-${String(index)}`)}
                  </p>
                )}

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(crm?.credentials ?? []).map((field) => (
                    <div key={field.key} className="flex flex-col gap-1">
                      <Label htmlFor={`cred-${String(index)}-${field.key}`}>{field.label}</Label>
                      <Input
                        id={`cred-${String(index)}-${field.key}`}
                        type={field.secret ? 'password' : 'text'}
                        autoComplete="off"
                        value={connection.credentials[field.key] ?? ''}
                        placeholder={saved?.hasCredentials ? 'stored — type to replace' : ''}
                        onChange={(event) =>
                          change({
                            credentials: {
                              ...connection.credentials,
                              [field.key]: event.target.value,
                            },
                          })
                        }
                      />
                      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!connection.provider}
                    onClick={() => void tryLogin(connection)}
                  >
                    Check the login
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => change({ active: !connection.active })}
                  >
                    {connection.active ? 'Pause this connection' : 'Resume this connection'}
                  </Button>
                  <Badge tone={connection.active ? 'ok' : 'muted'}>
                    {connection.active ? 'fetching' : 'paused'}
                  </Badge>
                  <Confirm
                    label={<Trash2 aria-hidden="true" />}
                    title={`Remove the connection ${connection.id}`}
                    what="Every record Core holds through this connection is removed from Core and from the tenant's sites at their next sync. The CRM itself is untouched."
                    confirmLabel="Remove the connection"
                    size="sm"
                    onConfirm={() =>
                      setForm({
                        ...form,
                        connections: form.connections.filter((_, other) => other !== index),
                      })
                    }
                  />
                  {saved && (
                    <span className="text-xs text-muted-foreground">
                      last fetched {ago(saved.lastIngestAt)}
                      {saved.lastError ? ` · last error: ${saved.lastError}` : ''}
                    </span>
                  )}
                </div>

                {saved && saved.loaded.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Loaded:{' '}
                    {saved.loaded.map((row) => `${count(row.live)} ${row.datatype}`).join(' · ')}
                  </p>
                )}

                {saved && saved.sections.length > 0 && (
                  <div className="mt-3">
                    <AdapterSections
                      sections={saved.sections}
                      run={(action, params) => runAdapterAction(saved.provider, action, params)}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <div>
            <Button
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  connections: [
                    ...form.connections,
                    {
                      id: '',
                      provider: crms[0]?.provider ?? '',
                      credentials: {},
                      offices: '',
                      active: true,
                    },
                  ],
                })
              }
            >
              <Plus aria-hidden="true" /> Add a CRM connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Its sites</CardTitle>
          <CardDescription>
            Each website that shows this customer’s listings: where Core rings it, and the secret it
            checks the bell with.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {form.sites.length === 0 && (
            <Empty what="No site yet. Add one, save, and paste its bell secret and the tenant token into the site." />
          )}
          {form.sites.map((site, index) => {
            const saved = tenant?.sites.find((one) => one.id === site.id);
            const change = (patch: Partial<SiteForm>): void => {
              const next = [...form.sites];
              next[index] = { ...site, ...patch };
              setForm({ ...form, sites: next });
            };
            return (
              <div key={index} className="rounded-lg border p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`site-label-${String(index)}`}>Name</Label>
                    <Input
                      id={`site-label-${String(index)}`}
                      value={site.label}
                      aria-invalid={problem(`site-${String(index)}`) !== undefined}
                      onChange={(event) => change({ label: event.target.value })}
                      placeholder="acme.se"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`site-bell-${String(index)}`}>Where Core rings it</Label>
                    <Input
                      id={`site-bell-${String(index)}`}
                      value={site.bellUrl}
                      aria-invalid={problem(`site-${String(index)}`) !== undefined}
                      onChange={(event) => change({ bellUrl: event.target.value })}
                      placeholder="https://acme.se/wp-json/core/v1/bell"
                    />
                  </div>
                </div>
                {problem(`site-${String(index)}`) && (
                  <p className="mt-2 text-sm text-danger">{problem(`site-${String(index)}`)}</p>
                )}

                {saved && (
                  <>
                    <div className="mt-3">
                      <Label>Its bell secret</Label>
                      <Copy value={saved.bellSecret} label="bell secret" />
                    </div>
                    <ul className="mt-3 flex flex-col gap-1 text-sm">
                      {saved.checklist.map((step) => (
                        <li key={step.step} className="flex items-start gap-2">
                          <Badge tone={step.done ? 'ok' : 'warn'}>
                            {step.done ? 'done' : 'to do'}
                          </Badge>
                          <span>
                            <strong className="font-medium">{step.step}.</strong>{' '}
                            <span className="text-muted-foreground">{step.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      It last pulled {ago(saved.lastPullAt)}
                      {saved.lastClient ? ` as ${saved.lastClient}` : ''} · last bell{' '}
                      {ago(saved.lastBellAt)} answered “{saved.lastBellStatus ?? 'nothing yet'}” ·
                      it reported {count(saved.applied.applied)} applied and{' '}
                      {count(saved.applied.failed)} failed
                    </p>
                    {saved.errors.length > 0 && (
                      <div className="mt-2 rounded-md border border-danger/40 bg-danger/5 p-2">
                        <p className="text-sm font-medium">What this site reported going wrong</p>
                        <ul className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                          {saved.errors.slice(0, 5).map((error, other) => (
                            <li key={other}>
                              {moment(error.at)} · {error.where} · {error.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => change({ active: !site.active })}
                  >
                    {site.active ? 'Switch this site off' : 'Switch this site on'}
                  </Button>
                  <Badge tone={site.active ? 'ok' : 'muted'}>{site.active ? 'on' : 'off'}</Badge>
                  {saved && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void post(`/sites/${String(saved.id)}/ring`)
                            .then(() => toast.success(`Rang ${saved.label}.`))
                            .catch((error: unknown) =>
                              toast.error(error instanceof Error ? error.message : String(error)),
                            )
                        }
                      >
                        Ring it
                      </Button>
                      <Confirm
                        label="New bell secret"
                        title={`Give ${saved.label} a new bell secret`}
                        what="This site stops answering Core's bells the moment the new secret exists, until the new value is pasted into it. It keeps pulling on its own schedule meanwhile."
                        confirmLabel="Make a new secret"
                        size="sm"
                        onConfirm={async () => {
                          await post(`/sites/${String(saved.id)}/secret`);
                          await query.refetch();
                          toast.success('New bell secret. Paste it into the site.');
                        }}
                      />
                    </>
                  )}
                  <Confirm
                    label={<Trash2 aria-hidden="true" />}
                    title={`Remove the site ${site.label || 'without a name'}`}
                    what="The site's row goes, and with it its bell secret and its whole history in the event log — what it was rung, what it pulled and what it applied. It keeps what it already shows until someone takes the plugin off it. This cannot be undone."
                    confirmLabel="Remove the site"
                    size="sm"
                    onConfirm={() =>
                      setForm({ ...form, sites: form.sites.filter((_, other) => other !== index) })
                    }
                  />
                </div>
              </div>
            );
          })}
          <div>
            <Button
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  sites: [...form.sites, { label: '', bellUrl: '', active: true }],
                })
              }
            >
              <Plus aria-hidden="true" /> Add a site
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
