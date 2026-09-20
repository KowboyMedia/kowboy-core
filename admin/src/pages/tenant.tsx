// One page makes a tenant and changes it, the same page and code path (Patric, 2026-09-20): the
// name and licence, the CRM connection with the login the adapter declares and the offices, the
// sites one or many, one Save that does it all in place. Below it, for an existing tenant: the
// token, the connection's state and actions, the sites' secrets, checklist and outcomes, what
// the adapter knows, the sites' own errors, the latest events, and the try-out tools.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { BellIcon, KeyRoundIcon, MoreHorizontalIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { api, ApiError, messageOf } from '@/api/client';
import { providersQuery, recordPath } from '@/api/queries';
import type {
  AdminAction,
  AdminField,
  ConnectionView,
  Inspection,
  TenantInput,
  TenantSaved,
  TenantView,
  TryChanges,
} from '@/api/types';
import { zodResolver, apiErrorsOf } from '@/lib/forms';
import { fmtBytes, fmtNumber } from '@/lib/format';
import { PageHeader, Section, Grid } from '@/components/page';
import { Kv } from '@/components/kv';
import { Moment } from '@/components/moment';
import { Secret } from '@/components/copy-button';
import { Confirm } from '@/components/confirm';
import { Sections, FieldInput } from '@/components/sections';
import { EventTable } from '@/components/event-table';
import { JsonView } from '@/components/json-view';
import { YesNo } from '@/components/state-badge';
import { PreviewButton, RefetchButton, RingButton } from '@/components/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DATATYPES = ['property', 'agent', 'office', 'area', 'association', 'project'];

// ---- The form: its shape, its rules, and the way to and from the API -------------------------

const siteSchema = z.object({
  id: z.number().optional(),
  label: z.string().trim().min(1, 'Give the site a name.'),
  url: z
    .string()
    .trim()
    .refine(
      (url) => /^https?:\/\/.+/.test(url),
      'The bell URL must start with http:// or https://.',
    ),
  active: z.boolean(),
  removed: z.boolean().optional(),
});

const formSchema = z.object({
  name: z.string().trim().min(1, 'Give the tenant a name.'),
  active: z.boolean(),
  provider: z.string(),
  credentials: z.record(z.string(), z.string()),
  offices: z.string(),
  connectionActive: z.boolean(),
  sites: z.array(siteSchema),
});

type Form = z.infer<typeof formSchema>;
type FormApi = ReturnType<typeof useForm<Form>>;

const EMPTY: Form = {
  name: '',
  active: true,
  provider: '',
  credentials: {},
  offices: '',
  connectionActive: true,
  sites: [],
};

const officesOf = (text: string): string[] =>
  text
    .split(/[\s,]+/)
    .map((office) => office.trim())
    .filter(Boolean);

function fromView(view: TenantView | undefined): Form {
  if (!view) return EMPTY;
  const connection = view.connection;
  return {
    name: view.tenant.name,
    active: view.tenant.active,
    provider: connection ? connection.provider : '',
    credentials: {},
    offices: connection ? connection.offices.join(', ') : '',
    connectionActive: connection ? connection.active : true,
    sites: view.sites.map((site) => ({
      id: site.id,
      label: site.label,
      url: site.url,
      active: site.active,
      removed: false,
    })),
  };
}

const siteInput = (site: Form['sites'][number]): TenantInput['sites'][number] => ({
  ...(site.id ? { id: site.id } : {}),
  label: site.label,
  url: site.url,
  active: site.active,
  removed: site.removed,
});

const toInput = (form: Form): TenantInput => ({
  name: form.name,
  active: form.active,
  connection: form.provider
    ? {
        provider: form.provider,
        credentials: Object.values(form.credentials).some(Boolean) ? form.credentials : null,
        offices: officesOf(form.offices),
        active: form.connectionActive,
      }
    : null,
  sites: form.sites.map(siteInput),
});

/** The API's field paths, mapped onto the form's. */
const errorPath = (path: string): string =>
  path
    .replace(/^connection\.credentials\./, 'credentials.')
    .replace(/^connection\.offices$/, 'offices')
    .replace(/^connection\.provider$/, 'provider');

/** Nested field errors as "a.b.0.c" paths, for setError. */
function flatten(
  errors: Record<string, unknown>,
  prefix = '',
): Record<string, { type: string; message: string }> {
  const out: Record<string, { type: string; message: string }> = {};
  for (const [key, value] of Object.entries(errors)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!value || typeof value !== 'object') continue;
    if (typeof (value as { message?: unknown }).message === 'string')
      out[path] = value as { type: string; message: string };
    else Object.assign(out, flatten(value as Record<string, unknown>, path));
  }
  return out;
}

function showApiErrors(form: FormApi, errors: Record<string, string>): void {
  const mapped = Object.fromEntries(
    Object.entries(errors).map(([path, message]) => [errorPath(path), message]),
  );
  const fieldErrors = apiErrorsOf<Form>(mapped) as FieldErrors<Form>;
  for (const [path, value] of Object.entries(flatten(fieldErrors)))
    form.setError(path as keyof Form, value);
}

// ---- The form's cards --------------------------------------------------------------------------

function TenantCard({ form }: { form: FormApi }) {
  const errors = form.formState.errors;
  return (
    <Section
      title="Tenant"
      help="The customer’s name, and whether its licence is on. A disabled licence stops the bells and the pulls; the sites keep what they show."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...form.register('name')} aria-invalid={Boolean(errors.name)} />
          {errors.name && <p className="text-xs text-bad">{errors.name.message}</p>}
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch
            checked={form.watch('active')}
            onCheckedChange={(value) => form.setValue('active', value, { shouldDirty: true })}
          />
          Licence active
        </label>
      </div>
    </Section>
  );
}

/** The login the adapter declares: hidden fields, stored encrypted, replaced only as a whole. */
function LoginFields({
  form,
  fields,
  stored,
}: {
  form: FormApi;
  fields: AdminField[];
  stored: boolean;
}) {
  const errors = form.formState.errors.credentials as
    Record<string, { message?: string }> | undefined;
  if (fields.length === 0) return null;
  return (
    <>
      <div className="text-sm font-medium">Login {stored && <Badge variant="ok">set</Badge>}</div>
      {stored && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Stored encrypted and never shown. Leave every field empty to keep it; fill all of them to
          replace it.
        </p>
      )}
      {fields.map((field) => (
        <FieldInput
          key={field.key}
          id={`credential-${field.key}`}
          field={{ ...field, required: !stored && field.required !== false }}
          value={form.watch(`credentials.${field.key}`) ?? ''}
          onChange={(value) => {
            form.setValue(`credentials.${field.key}`, value, { shouldDirty: true });
            form.clearErrors(`credentials.${field.key}`);
          }}
          error={errors?.[field.key]?.message}
        />
      ))}
    </>
  );
}

/** "Check the login": the adapter tries the CRM with what is typed, before anything is saved. */
function ProbeButton({ form, provider }: { form: FormApi; provider: string }) {
  const [probe, setProbe] = useState<{ ok: boolean; detail: string } | null>(null);
  const check = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; detail: string }>(
        `/v1/admin/providers/${encodeURIComponent(provider)}/probe`,
        {
          body: {
            credentials: form.getValues('credentials'),
            offices: officesOf(form.getValues('offices')),
          },
        },
      ),
    onSuccess: (result) => setProbe(result),
    onError: (error) => setProbe({ ok: false, detail: messageOf(error) }),
  });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={check.isPending}
        onClick={() => check.mutate()}
        data-testid="probe"
      >
        <KeyRoundIcon /> {check.isPending ? 'Checking…' : 'Check the login'}
      </Button>
      {probe && (
        <span
          className={probe.ok ? 'text-sm text-ok' : 'text-sm text-bad'}
          data-testid="probe-result"
        >
          {probe.ok ? 'Yes: ' : 'No: '}
          {probe.detail}
        </span>
      )}
    </div>
  );
}

function ProviderChoice({ form, fixed }: { form: FormApi; fixed: boolean }) {
  const providers = useQuery(providersQuery());
  const provider = form.watch('provider');
  const error = form.formState.errors.provider;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="provider">CRM</Label>
      {fixed ? (
        <Input id="provider" value={provider} readOnly />
      ) : (
        <Select
          value={provider || 'none'}
          onValueChange={(value) =>
            form.setValue('provider', value === 'none' ? '' : value, { shouldDirty: true })
          }
        >
          <SelectTrigger id="provider" aria-invalid={Boolean(error)}>
            <SelectValue placeholder="Choose a CRM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">none yet</SelectItem>
            {(providers.data ?? []).map((candidate) => (
              <SelectItem key={candidate.provider} value={candidate.provider}>
                {candidate.provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {error && <p className="text-xs text-bad">{error.message}</p>}
    </div>
  );
}

function CrmCard({ form, view }: { form: FormApi; view: TenantView | undefined }) {
  const providers = useQuery(providersQuery());
  const chosen = providers.data?.find((candidate) => candidate.provider === form.watch('provider'));
  const officesError = form.formState.errors.offices;
  return (
    <Section
      title="CRM connection"
      help="Which CRM the customer uses and the login its adapter needs; the offices are what Core syncs for the sites. The connection is loaded once the login and the offices are there."
    >
      <div className="flex flex-col gap-4">
        <ProviderChoice form={form} fixed={Boolean(view?.connection)} />
        {chosen && (
          <div
            className="flex flex-col gap-4 rounded-md border bg-muted/30 p-4"
            data-testid="crm-panel"
          >
            <LoginFields
              form={form}
              fields={chosen.credentials}
              stored={view?.connection?.has_credentials === true}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offices">Offices</Label>
              <Textarea
                id="offices"
                rows={2}
                {...form.register('offices')}
                aria-invalid={Boolean(officesError)}
                placeholder="One or more office ids, separated by commas or spaces"
              />
              {officesError ? (
                <p className="text-xs text-bad">{officesError.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Only these offices are synced. An office added later is loaded on save; one taken
                  away is taken off the sites.
                </p>
              )}
            </div>
            {chosen.can.probe && <ProbeButton form={form} provider={chosen.provider} />}
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={form.watch('connectionActive')}
                onCheckedChange={(value) =>
                  form.setValue('connectionActive', value, { shouldDirty: true })
                }
              />
              Connection active
            </label>
          </div>
        )}
      </div>
    </Section>
  );
}

function SiteRow({
  form,
  index,
  onRemove,
}: {
  form: FormApi;
  index: number;
  onRemove: () => void;
}) {
  const errors = form.formState.errors.sites?.[index];
  return (
    <div
      className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_2fr_auto_auto] md:items-start"
      data-testid="site-row"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`site-label-${index}`}>Name</Label>
        <Input
          id={`site-label-${index}`}
          {...form.register(`sites.${index}.label`)}
          aria-invalid={Boolean(errors?.label)}
          placeholder="acme.se"
        />
        {errors?.label && <p className="text-xs text-bad">{errors.label.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`site-url-${index}`}>Bell URL</Label>
        <Input
          id={`site-url-${index}`}
          {...form.register(`sites.${index}.url`)}
          aria-invalid={Boolean(errors?.url)}
          placeholder="https://acme.se/wp-json/core-client/v1/bell"
        />
        {errors?.url && <p className="text-xs text-bad">{errors.url.message}</p>}
      </div>
      <label className="flex items-center gap-2 pt-7 text-sm">
        <Switch
          checked={form.watch(`sites.${index}.active`)}
          onCheckedChange={(value) =>
            form.setValue(`sites.${index}.active`, value, { shouldDirty: true })
          }
        />
        Active
      </label>
      <div className="pt-6">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove this site"
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}

function SitesFormCard({ form }: { form: FormApi }) {
  const sites = useFieldArray({ control: form.control, name: 'sites' });
  const removed = (index: number): boolean => form.watch(`sites.${index}.removed`) === true;
  const shown = sites.fields.filter((_, index) => !removed(index));
  /** A stored site is marked removed and deleted on save; one only typed is simply dropped. */
  const remove = (index: number): void => {
    if (form.getValues(`sites.${index}.id`))
      form.setValue(`sites.${index}.removed`, true, { shouldDirty: true });
    else sites.remove(index);
  };
  return (
    <Section
      title="Sites"
      help="The websites that show this tenant’s records: each gets its own bell secret on save, and pulls with the tenant’s token. Paste both into the site’s own settings."
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => sites.append({ label: '', url: '', active: true, removed: false })}
          data-testid="add-site"
        >
          <PlusIcon /> Add site
        </Button>
      }
    >
      {shown.length === 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          No sites yet. A tenant without a site is fine to save; add one when the site exists.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {sites.fields.map((site, index) =>
          removed(index) ? null : (
            <SiteRow key={site.id} form={form} index={index} onRemove={() => remove(index)} />
          ),
        )}
      </div>
    </Section>
  );
}

function TenantForm({
  view,
  onSaved,
}: {
  view: TenantView | undefined;
  onSaved: (saved: TenantSaved) => void;
}) {
  const form = useForm<Form>({ resolver: zodResolver(formSchema), defaultValues: fromView(view) });
  const tenantId = view?.tenant.id;
  useEffect(() => {
    // The form follows the tenant it shows, and only that.
    form.reset(fromView(view));
  }, [tenantId]);

  const save = useMutation({
    mutationFn: (input: TenantInput) =>
      view
        ? api<TenantSaved>(`/v1/admin/tenants/${view.tenant.id}`, { method: 'PUT', body: input })
        : api<TenantSaved>('/v1/admin/tenants', { body: input }),
    onSuccess: (saved) => {
      toast.success(saved.notes.length > 0 ? saved.notes.join(' ') : 'Saved.', { duration: 8000 });
      onSaved(saved);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) showApiErrors(form, error.errors);
      toast.error(messageOf(error));
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((values) => save.mutate(toInput(values)))}
      className="flex flex-col gap-4 pb-2"
      noValidate
      data-testid="tenant-form"
    >
      <Grid>
        <TenantCard form={form} />
        <CrmCard form={form} view={view} />
      </Grid>
      <SitesFormCard form={form} />
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        {form.formState.isDirty && (
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
        )}
        <Button type="submit" disabled={save.isPending} data-testid="save">
          {save.isPending ? 'Saving…' : view ? 'Save' : 'Make the tenant'}
        </Button>
      </div>
    </form>
  );
}

// ---- Below the form: what exists ---------------------------------------------------------------

function TokenCard({ view, refresh }: { view: TenantView; refresh: () => void }) {
  const rotate = useMutation({
    mutationFn: () =>
      api<{ token: string }>(`/v1/admin/tenants/${view.tenant.id}/token`, { body: {} }),
    onSuccess: () => {
      toast.success('New token: paste it into every site; the old one stops working now.');
      refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <Section
      title="Token"
      help="What the sites pull with. Paste it into each site’s settings together with the site’s bell secret."
      actions={
        <Confirm
          title="Retire the token?"
          description="Every site of this tenant stops pulling until the new token is pasted into it."
          action="New token"
          danger
          onConfirm={() => rotate.mutateAsync().then(() => undefined)}
        >
          <Button variant="outline" size="sm">
            <KeyRoundIcon /> New token
          </Button>
        </Confirm>
      }
    >
      {view.tenant.token ? (
        <Secret value={view.tenant.token} label="Copy token" />
      ) : (
        <p className="text-sm text-muted-foreground">
          This tenant was made before tokens were kept for display; press “New token” to get one you
          can see.
        </p>
      )}
    </Section>
  );
}

/** What the connection card says about the connection, row by row. */
function connectionRows(connection: ConnectionView): [ReactNode, ReactNode][] {
  const load = connection.load;
  return [
    ['Connection', <code key="id">{connection.id}</code>],
    [
      'Login',
      connection.has_credentials ? (
        <Badge variant="ok">set</Badge>
      ) : (
        <Badge variant="bad">missing: nothing is loaded until it is typed above and saved</Badge>
      ),
    ],
    [
      'Offices',
      connection.offices.length > 0 ? (
        connection.offices.join(', ')
      ) : (
        <Badge variant="bad">none: nothing is loaded</Badge>
      ),
    ],
    ['Active', <YesNo key="active" value={connection.active} />],
    ['Last write from the CRM', <Moment key="ingest" at={connection.last_ingest_at} ago />],
    [
      'Last error',
      connection.last_error ? (
        <span className="text-bad">{connection.last_error}</span>
      ) : (
        <span className="text-muted-foreground">none</span>
      ),
    ],
    [
      'Latest load',
      load ? (
        <span>
          {load.event} started <Moment at={load.startedAt} ago />: {fmtNumber(load.written)}{' '}
          written, {fmtNumber(load.unchanged)} unchanged, {fmtNumber(load.removed)} removed,{' '}
          {fmtNumber(load.dropped)} dropped
        </span>
      ) : (
        <span className="text-muted-foreground">no load yet</span>
      ),
    ],
  ];
}

/** The loads and actions handed to the worker for a connection. */
function ConnectionActions({
  connection,
  refresh,
}: {
  connection: ConnectionView;
  refresh: () => void;
}) {
  const [datatype, setDatatype] = useState('all');
  const event = useMutation({
    mutationFn: (input: { event: string; datatype?: string }) =>
      api(`/v1/admin/connections/${encodeURIComponent(connection.id)}/events`, { body: input }),
    onSuccess: (_, input) => {
      toast.success(`Queued ${input.event}; the worker hands it to the adapter within seconds.`);
      refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const queue = (input: { event: string; datatype?: string }) => () =>
    event.mutateAsync(input).then(() => undefined);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Confirm
        title="Load everything?"
        description={`Every record of the licensed offices is fetched from ${connection.provider} again, and whatever they refer to. Saving the tenant already loads new offices; use this when in doubt.`}
        action="Load everything"
        onConfirm={queue({ event: 'connection_added' })}
      >
        <Button variant="outline" size="sm">
          Load everything
        </Button>
      </Confirm>
      <div className="flex items-center gap-1">
        <Select value={datatype} onValueChange={setDatatype}>
          <SelectTrigger size="sm" className="w-36" aria-label="Datatype to resync">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all datatypes</SelectItem>
            {DATATYPES.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Confirm
          title="Resync?"
          description={`${connection.provider}’s list is fetched again for ${datatype === 'all' ? 'every datatype' : datatype}, and what is no longer on it is taken off the sites.`}
          action="Resync"
          onConfirm={queue(
            datatype === 'all' ? { event: 'resync' } : { event: 'resync', datatype },
          )}
        >
          <Button variant="outline" size="sm">
            Resync
          </Button>
        </Confirm>
      </div>
      <PreviewButton scope={{ connectionId: connection.id }} label="Preview a recompute" />
      <Confirm
        title="Remove everything?"
        description="Every record of this connection is taken off the sites and the connection is switched off. The records stay 90 days as removal markers."
        action="Remove everything"
        danger
        onConfirm={queue({ event: 'connection_removed' })}
      >
        <Button variant="destructive" size="sm">
          Remove everything
        </Button>
      </Confirm>
    </div>
  );
}

function ConnectionCard({ view, refresh }: { view: TenantView; refresh: () => void }) {
  const connection = view.connection;
  const client = useQueryClient();
  const run = async (
    action: AdminAction,
    params: Record<string, string>,
  ): Promise<{ message: string }> => {
    const result = await api<{ message: string }>(
      `/v1/admin/providers/${encodeURIComponent(connection?.provider ?? '')}/actions`,
      { body: { action: action.id, params } },
    );
    void client.invalidateQueries({ queryKey: ['tenant', String(view.tenant.id)] });
    return result;
  };
  if (!connection) return null;
  return (
    <>
      <Section
        title="Connection"
        help="Its state, what the latest load has brought in, and the loads and actions handed to the worker."
      >
        <Kv rows={connectionRows(connection)} />
        <ConnectionActions connection={connection} refresh={refresh} />
      </Section>
      {connection.sections.length > 0 && <Sections sections={connection.sections} run={run} />}
      {connection.can.inspect && <InspectCard connection={connection} />}
    </>
  );
}

/** Look at one record of the CRM raw, unified and display without writing, or fetch it by hand. */
function InspectCard({ connection }: { connection: ConnectionView }) {
  const [datatype, setDatatype] = useState('property');
  const [remoteId, setRemoteId] = useState('');
  const [officeId, setOfficeId] = useState('');
  const look = useMutation({
    mutationFn: () =>
      api<Inspection>(`/v1/admin/connections/${encodeURIComponent(connection.id)}/inspect`, {
        body: { datatype, remoteId, officeId: officeId || undefined },
      }),
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <Section
      title="Look at a record"
      help={`Fetch one record from ${connection.provider} by hand and see it raw, unified and as display strings; nothing is written. “Fetch again” puts it on the adapter’s list for the worker, stored or not.`}
    >
      <div className="grid gap-3 md:grid-cols-[10rem_1fr_1fr_auto_auto] md:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspect-datatype">Datatype</Label>
          <Select value={datatype} onValueChange={setDatatype}>
            <SelectTrigger id="inspect-datatype">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATATYPES.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspect-id">Record id</Label>
          <Input
            id="inspect-id"
            value={remoteId}
            onChange={(event) => setRemoteId(event.target.value)}
            placeholder="The id the CRM uses"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspect-office">Office (optional)</Label>
          <Input
            id="inspect-office"
            value={officeId}
            onChange={(event) => setOfficeId(event.target.value)}
            placeholder="Known from the record when left empty"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!remoteId || look.isPending}
          onClick={() => look.mutate()}
          data-testid="look"
        >
          {look.isPending ? 'Fetching…' : 'Look'}
        </Button>
        <RefetchButton
          scope={{ connectionId: connection.id }}
          records={[{ datatype, remoteId, officeId: officeId || null }]}
          label="Fetch again"
          disabled={!remoteId}
          size="default"
        />
      </div>
      {look.data && (
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <JsonView title="Raw, as the CRM sent it" value={look.data.raw} openDepth={1} />
          <JsonView title="Unified" value={look.data.unified} openDepth={1} />
          <JsonView title="Display" value={look.data.display} openDepth={1} />
        </div>
      )}
    </Section>
  );
}

function SiteMenu({
  view,
  site,
  refresh,
}: {
  view: TenantView;
  site: TenantView['sites'][number];
  refresh: () => void;
}) {
  const secret = useMutation({
    mutationFn: () => api<{ secret: string }>(`/v1/admin/sites/${site.id}/secret`, { body: {} }),
    onSuccess: () => {
      toast.success(
        'New bell secret: paste it into the site; bells with the old one are refused now.',
      );
      refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const ring = useMutation({
    mutationFn: (kind: 'delta' | 'forcerefresh') =>
      api(`/v1/admin/tenants/${view.tenant.id}/ring`, { body: { site: site.id, kind } }),
    onSuccess: () =>
      toast.success('Rung; the site pulls within seconds. Its answer shows in the row.'),
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${site.label}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => ring.mutate('delta')}>
          <BellIcon /> Ring: pull changes
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => ring.mutate('forcerefresh')}>
          <BellIcon /> Ring: pull everything
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            if (
              window.confirm(
                `Give ${site.label} a new bell secret? Bells with the old one are refused once it is pasted.`,
              )
            )
              secret.mutate();
          }}
        >
          <KeyRoundIcon /> New bell secret
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SitesCard({ view, refresh }: { view: TenantView; refresh: () => void }) {
  return (
    <Section
      title="Sites as they stand"
      help="Each site’s bell secret, when it was last rung and what it answered, and when the tenant’s token last pulled. A site is set up when its bell is answered, a pull has happened and a record was applied."
      flush
    >
      {view.sites.length === 0 ? (
        <p className="px-5 text-sm text-muted-foreground">No sites yet: add one above and save.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Site</TableHead>
              <TableHead>Bell secret</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Last bell</TableHead>
              <TableHead>Bell answered</TableHead>
              <TableHead>Last pull (tenant)</TableHead>
              <TableHead className="pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.sites.map((site) => (
              <TableRow key={site.id} data-site={site.label}>
                <TableCell className="pl-5">
                  <div className="font-medium">{site.label}</div>
                  <div className="max-w-xs truncate text-xs text-muted-foreground" title={site.url}>
                    {site.url}
                  </div>
                </TableCell>
                <TableCell>
                  <Secret value={site.secret} label="Copy secret" />
                </TableCell>
                <TableCell>
                  <YesNo value={site.active} />
                </TableCell>
                <TableCell>
                  <Moment at={site.last_bell_at} ago />
                  {site.last_bell_status && (
                    <span
                      className={
                        site.last_bell_status === 'ok'
                          ? 'ml-1 text-xs text-ok'
                          : 'ml-1 text-xs text-bad'
                      }
                    >
                      {site.last_bell_status}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {site.bell_answered_at ? (
                    <Badge variant="ok">yes</Badge>
                  ) : (
                    <Badge variant="warn">not yet</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Moment at={site.last_pull_at} ago />
                  {site.last_client && (
                    <span className="ml-1 text-xs text-muted-foreground">{site.last_client}</span>
                  )}
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <SiteMenu view={view} site={site} refresh={refresh} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

function ChecklistCard({ view }: { view: TenantView }) {
  const connected =
    Boolean(view.connection?.has_credentials) && (view.connection?.offices.length ?? 0) > 0;
  const steps: [string, boolean, string][] = [
    ['The tenant is made and has a token', true, ''],
    ['The CRM login and offices are saved', connected, 'type them above and save'],
    [
      'Records are loaded',
      view.records.some((row) => row.live > 0),
      'the first load runs after the save; the connection card shows its progress',
    ],
    [
      'A site answered its bell',
      view.sites.some((site) => site.bell_answered_at),
      'paste the bell secret into the site, then ring it',
    ],
    [
      'A site pulled with the token',
      Boolean(view.checklist.first_pull_at),
      'paste the token into the site; it pulls on the bell or on its schedule',
    ],
    [
      'A site applied a record',
      Boolean(view.checklist.first_applied_at),
      'happens on the first pull with records',
    ],
  ];
  return (
    <Section
      title="Setup checklist"
      help="What has happened end to end, from the tenant to the first record on a site."
    >
      <ul className="flex flex-col gap-2 text-sm">
        {steps.map(([label, done, hint]) => (
          <li key={label} className="flex items-start gap-2">
            {done ? <Badge variant="ok">done</Badge> : <Badge variant="muted">to do</Badge>}
            <span>
              {label}
              {!done && hint && <span className="text-muted-foreground"> · {hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ParityCard({ view }: { view: TenantView }) {
  const rows = view.records.map((row) => ({
    ...row,
    outcome: view.outcomes.find((outcome) => outcome.datatype === row.datatype),
  }));
  return (
    <Section
      title="Records here and on the sites"
      help="What Core holds per datatype, and what the sites reported back: records applied, and records whose latest report was a failure on the site’s side. Only what the event log still holds (30 days)."
      flush
    >
      {rows.length === 0 ? (
        <p className="px-5 text-sm text-muted-foreground">No records yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Datatype</TableHead>
              <TableHead className="text-right">Live in Core</TableHead>
              <TableHead className="text-right">Removed</TableHead>
              <TableHead className="text-right">Applied by sites</TableHead>
              <TableHead className="pr-5 text-right">Failed on sites</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.datatype}>
                <TableCell className="pl-5">{row.datatype}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtNumber(row.live)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtNumber(row.tombstoned)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtNumber(row.outcome?.applied ?? 0)}
                </TableCell>
                <TableCell
                  className={
                    row.outcome?.failed
                      ? 'pr-5 text-right tabular-nums text-bad'
                      : 'pr-5 text-right tabular-nums'
                  }
                >
                  {fmtNumber(row.outcome?.failed ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {view.failures.length > 0 && (
        <div className="px-5 pt-4">
          <h4 className="mb-2 text-sm font-medium">Failed on the sites</h4>
          <ul className="flex flex-col gap-1 text-sm">
            {view.failures.map((failure) => (
              <li key={`${failure.datatype}/${failure.remote_id}`}>
                <Link
                  to={recordPath(view.connection?.id ?? '', failure.datatype, failure.remote_id)}
                  className="text-primary hover:underline"
                >
                  {failure.datatype} {failure.remote_id}
                </Link>
                <span className="text-muted-foreground">
                  {' '}
                  · <Moment at={failure.at} ago /> · {failure.client ?? 'site'}:{' '}
                  {failure.detail ?? 'no reason given'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function TryCard({ view }: { view: TenantView }) {
  const [datatype, setDatatype] = useState('property');
  const [after, setAfter] = useState('0');
  const [open, setOpen] = useState(false);
  const pull = useMutation({
    mutationFn: () =>
      api<TryChanges>('/v1/admin/try/changes', {
        body: { tenantId: view.tenant.id, datatype, after: Number(after) || 0, limit: 100 },
      }),
    onSuccess: () => setOpen(true),
    onError: (error) => toast.error(messageOf(error)),
  });
  const answer = pull.data;
  return (
    <Section
      title="Try it as a site"
      help="Pull this tenant’s records exactly as a site does, and see the answer with its size plain and gzipped; or ring the sites now. Nothing here touches the CRM."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="try-datatype">Datatype</Label>
          <Select value={datatype} onValueChange={setDatatype}>
            <SelectTrigger id="try-datatype" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATATYPES.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="try-after">After seq</Label>
          <Input
            id="try-after"
            className="w-32"
            type="number"
            min={0}
            value={after}
            onChange={(event) => setAfter(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pull.isPending}
          onClick={() => pull.mutate()}
          data-testid="try-pull"
        >
          Pull as a site
        </Button>
        <RingButton tenantId={view.tenant.id} size="default" />
        <RingButton tenantId={view.tenant.id} kind="forcerefresh" size="default" />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              GET /v1/changes?datatype={datatype}&after={after}
            </DialogTitle>
            <DialogDescription>
              {answer &&
                `${answer.items.length} item(s), next after ${answer.next_after}, ${answer.has_more ? 'more to come' : 'nothing more'} · ${fmtBytes(answer.bytes)} plain, ${fmtBytes(answer.gzipBytes)} gzipped`}
            </DialogDescription>
          </DialogHeader>
          {answer && <JsonView title="The answer" value={answer.items} openDepth={1} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

/** Everything below the form on an existing tenant. */
function Existing({ view, refresh }: { view: TenantView; refresh: () => void }) {
  const navigate = useNavigate();
  return (
    <>
      <Grid>
        <TokenCard view={view} refresh={refresh} />
        <ChecklistCard view={view} />
      </Grid>
      <ConnectionCard view={view} refresh={refresh} />
      <SitesCard view={view} refresh={refresh} />
      <Grid>
        <ParityCard view={view} />
        <Section
          title="The sites’ own errors"
          help="What the sites reported to Core through /v1/errors, the latest 20. One report a day per bug also leaves for Sentry."
          flush
        >
          <EventTable events={view.errors} empty="No errors reported by the sites." />
        </Section>
      </Grid>
      <TryCard view={view} />
      <Section
        title="Latest events"
        help="The 20 newest events of this tenant. The Events page searches the whole log."
        flush
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={`/events?tenant=${view.tenant.id}`}>All events</Link>
          </Button>
        }
      >
        <EventTable
          events={view.events}
          onCorrelation={(correlation) =>
            navigate(`/events?correlation=${encodeURIComponent(correlation)}`)
          }
        />
      </Section>
    </>
  );
}

// ---- The page ----------------------------------------------------------------------------------

export function TenantPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const tenantId = id ? Number(id) : undefined;
  const view = useQuery({
    queryKey: ['tenant', id ?? 'new'],
    queryFn: () => api<TenantView>(`/v1/admin/tenants/${tenantId}`),
    enabled: tenantId !== undefined,
  });
  const refresh = (): void => {
    void client.invalidateQueries({ queryKey: ['tenant', id ?? 'new'] });
    void client.invalidateQueries({ queryKey: ['tenants'] });
  };
  const onSaved = (saved: TenantSaved): void => {
    client.setQueryData(['tenant', String(saved.id)], saved);
    void client.invalidateQueries({ queryKey: ['tenants'] });
    if (view.data) refresh();
    else navigate(`/tenants/${saved.id}`, { replace: true });
  };
  if (tenantId !== undefined && view.isPending) return <Skeleton className="h-96" />;
  if (view.error) return <p className="text-bad">{view.error.message}</p>;
  const data = view.data;
  return (
    <>
      <PageHeader
        eyebrow={data ? `Tenant #${data.tenant.id}` : 'New tenant'}
        title={data ? data.tenant.name : 'Make a tenant'}
        intro={
          data
            ? 'Everything about this customer. Change what you need above and save; the rest of the page shows what exists and what to do next.'
            : 'The customer’s name, its CRM login and offices, and its sites. One save makes everything: the tenant with its token, the connection with its first load, and a bell secret per site.'
        }
        actions={
          data ? (
            <RefetchButton scope={{ tenantId: data.tenant.id }} label="Fetch everything again" />
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4">
        <TenantForm view={data} onSaved={onSaved} />
        {data && <Existing view={data} refresh={refresh} />}
      </div>
    </>
  );
}
