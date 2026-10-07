// A tenant (Patric, 2026-10-06, built from zero from his list): its name, whether it is enabled
// and its token; its CRM connections, each with its name, its CRM and that CRM's login, "Check
// login" and what the CRM code reports about it, such as the offices it lists, with the tenant's
// records on their way under them; and its sites, each with its address, its bell
// path and its bell secret. One Save writes the page. A connection is known by a name a person
// types and can change; Core's own id for it is never shown (Patric, 2026-10-07). A link ending
// in #connection:<Core's id> or #site:<number> scrolls to that block and marks it.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import {
  Value,
  type AdminAction,
  type AdminField,
  type AdminSection,
} from '@/components/adapter-sections';
import { Confirm } from '@/components/confirm';
import { Copy } from '@/components/copy';
import { Explained } from '@/components/explained';
import { FlowList } from '@/components/flow';
import { PageHeader } from '@/components/layout';
import { useScopeOptions } from '@/components/scope-picker';
import { crmName } from '@/lib/format';
import { EMPTY_SCOPE } from '@/lib/scope';
import { cn } from '@/lib/utils';

/** A CRM Core has code for, with the login its connections ask for. */
type Crm = { provider: string; credentials: AdminField[] };

type ConnectionView = {
  id: string;
  name: string;
  provider: string;
  licensedOffices: string[];
  /** The stored value of each login field that is not secret. */
  shown: Record<string, string>;
  /** Every login field that holds a value, secret or not. */
  filled: string[];
  /** What the CRM code reports about this connection. */
  sections: AdminSection[];
};

type SiteView = { id: number; label: string; bellUrl: string; bellSecret: string };

type TenantView = {
  id: number;
  displayName: string;
  active: boolean;
  token: string | null;
  connections: ConnectionView[];
  sites: SiteView[];
};

type ConnectionDraft = {
  key: string;
  /** Core's id for it; null until it is saved. Never shown. */
  saved: string | null;
  name: string;
  provider: string;
  typed: Record<string, string>;
  /** Sent back as stored: nothing on this page changes them. */
  licensedOffices: string[];
};

type SiteDraft = {
  key: string;
  id: number | null;
  address: string;
  bellPath: string;
};

type Draft = {
  displayName: string;
  active: boolean;
  connections: ConnectionDraft[];
  sites: SiteDraft[];
};

/** Where Core's WordPress plugin listens for the bell. */
const WORDPRESS_BELL = '/wp-json/core/v1/bell';

const isAddress = (text: string): boolean => /^https?:\/\//.test(text.trim());
const withoutSlash = (text: string): string => text.trim().replace(/\/+$/, '');

/**
 * A stored site as the page shows it: the site's address, and where on it Core rings. A site
 * saved here keeps its address as its name; an older one is read from its bell's address.
 */
function siteDraft(site: SiteView): SiteDraft {
  const base = { key: `site:${String(site.id)}`, id: site.id };
  const named = isAddress(site.label) ? withoutSlash(site.label) : null;
  if (named)
    return {
      ...base,
      address: named,
      bellPath: site.bellUrl.startsWith(`${named}/`)
        ? site.bellUrl.slice(named.length)
        : site.bellUrl,
    };
  try {
    const bell = new URL(site.bellUrl);
    return { ...base, address: bell.origin, bellPath: `${bell.pathname}${bell.search}` };
  } catch {
    return { ...base, address: '', bellPath: site.bellUrl };
  }
}

/** The bell's whole address: a path goes after the site's address, a whole address stays. */
const bellAddress = (site: SiteDraft): string => {
  const path = site.bellPath.trim();
  if (isAddress(path)) return path;
  return `${withoutSlash(site.address)}${path.startsWith('/') ? '' : '/'}${path}`;
};

const draftOf = (view: TenantView): Draft => ({
  displayName: view.displayName,
  active: view.active,
  connections: view.connections.map((connection) => ({
    key: `connection:${connection.id}`,
    saved: connection.id,
    name: connection.name,
    provider: connection.provider,
    typed: { ...connection.shown },
    licensedOffices: connection.licensedOffices,
  })),
  sites: view.sites.map(siteDraft),
});

const EMPTY: Draft = { displayName: '', active: true, connections: [], sites: [] };

/** The login fields that hold something; an empty one leaves what is stored. */
const typedOf = (connection: ConnectionDraft): Record<string, string> =>
  Object.fromEntries(Object.entries(connection.typed).filter(([, value]) => value.trim() !== ''));

/** The page as Core's save takes it. */
const bodyOf = (draft: Draft) => ({
  displayName: draft.displayName.trim(),
  active: draft.active,
  connections: draft.connections.map((connection) => ({
    ...(connection.saved === null ? {} : { id: connection.saved }),
    name: connection.name.trim(),
    provider: connection.provider,
    credentials: typedOf(connection),
    licensedOffices: connection.licensedOffices,
  })),
  sites: draft.sites.map((site) => ({
    ...(site.id === null ? {} : { id: site.id }),
    label: withoutSlash(site.address),
    bellUrl: bellAddress(site),
  })),
});

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

let made = 0;
const newKey = (kind: string): string => `${kind}:new:${String((made += 1))}`;

// ---- A login field ------------------------------------------------------------------------------

/** A field whose only choices are no and yes is a tickbox; ticked is yes. */
const isTickbox = (field: AdminField): boolean =>
  field.options?.length === 2 &&
  field.options.some((option) => option.value === 'no') &&
  field.options.some((option) => option.value === 'yes');

function LoginField({
  field,
  id,
  value,
  stored,
  onChange,
}: {
  field: AdminField;
  id: string;
  value: string;
  stored: boolean;
  onChange: (value: string) => void;
}) {
  const help = field.help && <p className="text-xs text-muted-foreground">{field.help}</p>;
  if (isTickbox(field))
    return (
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            // The CRM's code reads yes in any case, so a stored "Yes" shows ticked too.
            checked={value.trim().toLowerCase() === 'yes'}
            onChange={(event) => onChange(event.target.checked ? 'yes' : 'no')}
          />
          {field.label}
        </label>
        {help}
      </div>
    );
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{field.label}</Label>
      {field.options ? (
        <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {value === '' && <option value="">Pick one</option>}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label ?? option.value}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id={id}
          type={field.secret ? 'password' : 'text'}
          autoComplete={field.secret ? 'new-password' : 'off'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {field.secret && stored && value === '' && (
        <p className="text-xs text-muted-foreground">
          One is stored. Type a new one only to change it.
        </p>
      )}
      {help}
    </div>
  );
}

// ---- What the CRM code reports about a connection -----------------------------------------------

type Act = (action: AdminAction, params: Record<string, string>) => Promise<void>;

/** One button the CRM code declared, asking first when it says to. */
function ActionButton({ action, act }: { action: AdminAction; act: Act }) {
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      await act(action, { ...(action.params ?? {}), ...values });
    } finally {
      setBusy(false);
    }
  };
  if (action.confirm || action.danger || (action.fields ?? []).length > 0)
    return (
      <Confirm
        label={action.label}
        title={action.label}
        what={[action.help, action.confirm].filter(Boolean).join(' ')}
        confirmLabel={action.label}
        variant={action.danger ? 'danger' : 'secondary'}
        size="sm"
        onConfirm={run}
      >
        {(action.fields ?? []).map((field) => (
          <LoginField
            key={field.key}
            field={field}
            id={`${action.id}-${field.key}`}
            value={values[field.key] ?? ''}
            stored={false}
            onChange={(value) => setValues({ ...values, [field.key]: value })}
          />
        ))}
      </Confirm>
    );
  return (
    <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run()}>
      {busy ? 'Working…' : action.label}
    </Button>
  );
}

function Report({ section, act }: { section: AdminSection; act: Act }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-medium">{section.title}</h4>
      {section.help && <p className="text-sm text-muted-foreground">{section.help}</p>}
      {(section.actions ?? []).map((action) => (
        <Explained key={action.id} what={action.help ?? ''}>
          <ActionButton action={action} act={act} />
        </Explained>
      ))}
      {section.items && (
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
          {section.items.map((item) => (
            <div key={item.label} className="contents">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd>
                <Value value={item.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {section.table &&
        (section.table.rows.length === 0 ? (
          <p className="text-sm">{section.table.empty ?? 'Nothing yet.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  {section.table.columns.map((column) => (
                    <th key={column} className="py-1 pr-3 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((row) => (
                  <tr key={JSON.stringify(row.cells)} className="border-b align-top">
                    {row.cells.map((cell, index) => (
                      <td key={index} className="py-1 pr-3">
                        <Value value={cell} />
                      </td>
                    ))}
                    {(row.actions ?? []).length > 0 && (
                      <td className="py-1">
                        {(row.actions ?? []).map((action) => (
                          <div key={action.id} className="flex flex-col gap-1">
                            <ActionButton action={action} act={act} />
                            <span className="text-xs text-muted-foreground">{action.help}</span>
                          </div>
                        ))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

// ---- One CRM connection -------------------------------------------------------------------------

function Connection({
  draft,
  view,
  crms,
  tenantName,
  onChange,
  onRemove,
  act,
}: {
  draft: ConnectionDraft;
  view: ConnectionView | undefined;
  crms: Crm[];
  tenantName: string;
  onChange: (next: ConnectionDraft) => void;
  onRemove: () => void;
  act: (provider: string) => Act;
}) {
  const { mutateAsync } = useCustomMutation();
  const [checked, setChecked] = useState<{ ok: boolean; detail: string } | null>(null);
  const fields = crms.find((crm) => crm.provider === draft.provider)?.credentials ?? [];
  const title =
    draft.saved === null
      ? 'A new CRM connection'
      : `${tenantName}’s ${draft.provider ? crmName(draft.provider) : 'CRM'} connection “${draft.name.trim() || view?.name || ''}”`;

  const check = async (): Promise<void> => {
    try {
      const answer = await mutateAsync({
        url: `/crms/${draft.provider}/probe`,
        method: 'post',
        values: {
          credentials: typedOf(draft),
          officeIds: [],
          ...(draft.saved ? { connectionId: draft.saved } : {}),
        },
        successNotification: false,
        errorNotification: false,
      });
      setChecked(answer.data as unknown as { ok: boolean; detail: string });
    } catch (error) {
      setChecked({ ok: false, detail: message(error) });
    }
  };

  return (
    <section
      id={draft.saved ? `connection:${draft.saved}` : undefined}
      className="flex flex-col gap-3 rounded-md border p-3"
      aria-label={title}
    >
      <h3 className="font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${draft.key}-name`}>Name</Label>
          <Input
            id={`${draft.key}-name`}
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            What you call this connection, such as the brokerage or the CRM it reads. You can change
            it at any time.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${draft.key}-crm`}>CRM</Label>
          <Select
            id={`${draft.key}-crm`}
            value={draft.provider}
            onChange={(event) => {
              setChecked(null);
              onChange({ ...draft, provider: event.target.value, typed: {} });
            }}
          >
            {draft.provider === '' && <option value="">Pick one</option>}
            {crms.map((crm) => (
              <option key={crm.provider} value={crm.provider}>
                {crmName(crm.provider)}
              </option>
            ))}
          </Select>
        </div>
        {fields.map((field) => (
          <LoginField
            key={field.key}
            field={field}
            id={`${draft.key}-${field.key}`}
            value={draft.typed[field.key] ?? ''}
            stored={view?.filled.includes(field.key) ?? false}
            onChange={(value) =>
              onChange({ ...draft, typed: { ...draft.typed, [field.key]: value } })
            }
          />
        ))}
      </div>
      {draft.provider !== '' && (
        <Explained what="Tries the login typed above, or the stored one when nothing new is typed, and shows what the CRM answers. Nothing is saved.">
          <Button variant="secondary" size="sm" onClick={() => void check()}>
            Check login
          </Button>
        </Explained>
      )}
      {checked && (
        <p className={cn('text-sm', checked.ok ? 'text-ok' : 'text-danger')}>
          {checked.ok ? 'The check passed: ' : 'The check did not pass: '}
          {checked.detail}
        </p>
      )}
      {view?.sections.map((section) => (
        <Report key={section.title} section={section} act={act(view.provider)} />
      ))}
      <Explained
        what={
          draft.saved
            ? 'Takes this connection off the page. At Save, Core removes it and takes its records off the sites.'
            : 'Takes this new connection off the page.'
        }
      >
        {draft.saved ? (
          <Confirm
            label="Remove this connection"
            title="Remove this connection?"
            what="At Save, Core removes the connection and takes every record it brought off the sites. Nothing changes until you save."
            confirmLabel="Remove it"
            size="sm"
            onConfirm={onRemove}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={onRemove}>
            Remove this connection
          </Button>
        )}
      </Explained>
    </section>
  );
}

// ---- One site -----------------------------------------------------------------------------------

function Site({
  draft,
  secret,
  onChange,
  onRemove,
  onNewSecret,
}: {
  draft: SiteDraft;
  secret: string | null;
  onChange: (next: SiteDraft) => void;
  onRemove: () => void;
  onNewSecret: () => Promise<void>;
}) {
  return (
    <section
      id={draft.id === null ? undefined : `site:${String(draft.id)}`}
      className="flex flex-col gap-3 rounded-md border p-3"
      aria-label={draft.id === null ? 'A new site' : `The site ${draft.address}`}
    >
      <h3 className="font-semibold">{draft.id === null ? 'A new site' : draft.address}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${draft.key}-address`}>Address</Label>
          <Input
            id={`${draft.key}-address`}
            placeholder="https://example.se"
            value={draft.address}
            onChange={(event) => onChange({ ...draft, address: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            The site’s own address, starting with https://. Core names the site by it.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${draft.key}-bell`}>Bell path</Label>
          <Input
            id={`${draft.key}-bell`}
            value={draft.bellPath}
            onChange={(event) => onChange({ ...draft, bellPath: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Where on the site Core tells it that something changed, so it fetches at once. A
            WordPress site with Core’s plugin listens at {WORDPRESS_BELL}. A site that listens
            somewhere else, such as a Lovable site’s sync function, takes that whole address here.
          </p>
        </div>
      </div>
      {secret !== null && (
        <div className="flex flex-col gap-2">
          <Label>Bell secret</Label>
          <Copy value={secret} label="bell secret" />
          <p className="text-xs text-muted-foreground">
            Paste it into the site’s Core settings. The site believes Core’s word that something
            changed only when it carries this secret.
          </p>
          <Explained what="Makes a new secret and stops the old one at once. Until the new secret is pasted into the site’s Core settings, the site ignores Core’s word that something changed, and fetches only on its own schedule. Press it only when the secret has leaked.">
            <Confirm
              label="Make a new secret"
              title="Make a new bell secret?"
              what="The old secret stops working at once. Until the new one is pasted into the site’s Core settings, the site ignores Core’s word that something changed."
              confirmLabel="Make a new secret"
              size="sm"
              onConfirm={onNewSecret}
            />
          </Explained>
        </div>
      )}
      {secret === null && (
        <p className="text-sm text-muted-foreground">Core makes its bell secret when you save.</p>
      )}
      <Explained
        what={
          draft.id === null
            ? 'Takes this new site off the page.'
            : 'Takes this site off the page. At Save, Core removes it with its history, and stops telling it of changes.'
        }
      >
        {draft.id === null ? (
          <Button variant="outline" size="sm" onClick={onRemove}>
            Remove this site
          </Button>
        ) : (
          <Confirm
            label="Remove this site"
            title="Remove this site?"
            what="At Save, Core removes the site with its history and its bell secret, and no longer tells it of changes. Nothing changes until you save."
            confirmLabel="Remove it"
            size="sm"
            onConfirm={onRemove}
          />
        )}
      </Explained>
    </section>
  );
}

// ---- The page -----------------------------------------------------------------------------------

export function TenantPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNew = params['id'] === undefined || params['id'] === 'new';
  const id = isNew ? null : Number(params['id']);
  const options = useScopeOptions();
  const { mutateAsync } = useCustomMutation();

  const { result, query } = useCustom<TenantView>({
    url: `/tenants/${String(id)}`,
    method: 'get',
    errorNotification: false,
    queryOptions: { enabled: id !== null },
  });
  const crmList = useCustom<Crm[]>({ url: '/crms', method: 'get' });
  const crms: Crm[] = Array.isArray(crmList.result?.data) ? crmList.result.data : [];
  // Until Core answers, the hook holds an empty object rather than nothing.
  const view = result?.data?.connections ? result.data : undefined;

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [draftOfId, setDraftOfId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  // The page starts from what Core holds, once per tenant; later reads only refresh the reports.
  useEffect(() => {
    if (view && draftOfId !== view.id) {
      setDraft(draftOf(view));
      setDraftOfId(view.id);
      setToken(view.token);
      setSecrets(Object.fromEntries(view.sites.map((site) => [site.id, site.bellSecret])));
    }
  }, [view, draftOfId]);

  // A link to one connection or site scrolls to it and marks it for a moment.
  useEffect(() => {
    if (!view || location.hash === '') return;
    const block = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!block) return;
    block.scrollIntoView({ block: 'start' });
    block.classList.add('ring-2', 'ring-primary');
    const timer = window.setTimeout(() => block.classList.remove('ring-2', 'ring-primary'), 2500);
    return () => window.clearTimeout(timer);
  }, [view, location.hash]);

  const act =
    (provider: string): Act =>
    async (action, actionParams) => {
      try {
        const answer = await mutateAsync({
          url: `/crms/${provider}/act`,
          method: 'post',
          values: { action: action.id, params: actionParams },
          successNotification: false,
          errorNotification: false,
        });
        toast.success((answer.data as unknown as { message: string }).message);
        void query.refetch();
      } catch (error) {
        toast.error(message(error));
      }
    };

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      const answer = await mutateAsync({
        url: id === null ? '/tenants' : `/tenants/${String(id)}`,
        method: id === null ? 'post' : 'patch',
        values: bodyOf(draft),
        successNotification: false,
        errorNotification: false,
      });
      const saved = answer.data as unknown as TenantView & { changes: string[] };
      toast.success(['Saved.', ...saved.changes].join(' '));
      setDraft(draftOf(saved));
      setDraftOfId(saved.id);
      setToken(saved.token);
      setSecrets(Object.fromEntries(saved.sites.map((site) => [site.id, site.bellSecret])));
      if (id === null) void navigate(`/tenants/${String(saved.id)}`, { replace: true });
      else void query.refetch();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setSaving(false);
    }
  };

  const newToken = async (): Promise<void> => {
    try {
      const answer = await mutateAsync({
        url: `/tenants/${String(id)}/token`,
        method: 'post',
        values: {},
        successNotification: false,
        errorNotification: false,
      });
      setToken((answer.data as unknown as { token: string }).token);
      toast.success('Core made a new token. Paste it into every site of this tenant.');
    } catch (error) {
      toast.error(message(error));
    }
  };

  const newSecret = (site: number) => async (): Promise<void> => {
    try {
      const answer = await mutateAsync({
        url: `/sites/${String(site)}/secret`,
        method: 'post',
        values: {},
        successNotification: false,
        errorNotification: false,
      });
      setSecrets({
        ...secrets,
        [site]: (answer.data as unknown as { bellSecret: string }).bellSecret,
      });
      toast.success('Core made a new bell secret. Paste it into the site’s Core settings.');
    } catch (error) {
      toast.error(message(error));
    }
  };

  if (id !== null && !view) {
    return (
      <PageHeader
        title={query.isError ? 'Core cannot show this tenant' : 'Reading the tenant…'}
        what={query.isError ? message(query.error) : ''}
      />
    );
  }

  const tenantName = draft.displayName.trim() || 'This tenant';
  const change = (next: Partial<Draft>): void => setDraft({ ...draft, ...next });

  return (
    <>
      <PageHeader
        title={id === null ? 'New tenant' : (view?.displayName ?? '')}
        what="A tenant is one brokerage. Its CRM connections bring its records into Core, and its sites fetch them from Core with its token."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>The tenant</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex max-w-md flex-col gap-1">
            <Label htmlFor="tenant-name">Name</Label>
            <Input
              id="tenant-name"
              value={draft.displayName}
              onChange={(event) => change({ displayName: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              The brokerage’s name, as the admin area shows it.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => change({ active: event.target.checked })}
              />
              Enabled
            </label>
            <p className="text-xs text-muted-foreground">
              A disabled tenant’s sites can no longer fetch from Core, and Core stops telling them
              of changes. Its CRM connections keep loading records.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Token</Label>
            {id === null ? (
              <p className="text-sm text-muted-foreground">Core makes the token when you save.</p>
            ) : token ? (
              <>
                <Copy value={token} label="tenant token" />
                <p className="text-xs text-muted-foreground">
                  Paste it into each site’s Core settings. A site fetches with it, and Core knows
                  the tenant by it.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Core cannot show this tenant’s token, as it was made before Core kept tokens. Make a
                new one to see it.
              </p>
            )}
            {id !== null && (
              <Explained what="Makes a new token and stops the old one at once. Every site of this tenant then fails to fetch until the new token is pasted into it. Press it only when the token has leaked.">
                <Confirm
                  label="Make a new token"
                  title="Make a new token?"
                  what="The old token stops working at once. Every site of this tenant fails to fetch until the new token is pasted into its Core settings."
                  confirmLabel="Make a new token"
                  size="sm"
                  onConfirm={newToken}
                />
              </Explained>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>CRM connections</CardTitle>
          <CardDescription>
            Each connection logs in to one CRM and loads the brokerage’s records from it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {draft.connections.length === 0 && (
            <p className="text-sm">No CRM connection yet, so no record reaches Core.</p>
          )}
          {draft.connections.map((connection) => (
            <Connection
              key={connection.key}
              draft={connection}
              view={view?.connections.find((one) => one.id === connection.saved)}
              crms={crms}
              tenantName={tenantName}
              onChange={(next) =>
                change({
                  connections: draft.connections.map((one) =>
                    one.key === connection.key ? next : one,
                  ),
                })
              }
              onRemove={() =>
                change({
                  connections: draft.connections.filter((one) => one.key !== connection.key),
                })
              }
              act={act}
            />
          ))}
          <Explained what="Adds an empty connection to fill in. It loads nothing until you save.">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                change({
                  connections: [
                    ...draft.connections,
                    {
                      key: newKey('connection'),
                      saved: null,
                      name: '',
                      provider: crms.length === 1 ? (crms[0]?.provider ?? '') : '',
                      typed: {},
                      licensedOffices: [],
                    },
                  ],
                })
              }
            >
              Add a CRM connection
            </Button>
          </Explained>
          {id !== null && (
            <div className="flex flex-col gap-2">
              <h4 className="font-medium">Records on their way</h4>
              <p className="text-sm text-muted-foreground">
                This tenant’s records on their way from the CRM to the sites, newest first. A record
                waits for the CRM, then is in Core, then is on a site.
              </p>
              <FlowList scope={{ ...EMPTY_SCOPE, tenantIds: [id] }} options={options} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>
            Each site fetches this tenant’s records from Core with the token, and Core tells it when
            something changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {draft.sites.length === 0 && (
            <p className="text-sm">No site yet, so the records reach no website.</p>
          )}
          {draft.sites.map((site) => (
            <Site
              key={site.key}
              draft={site}
              secret={site.id === null ? null : (secrets[site.id] ?? null)}
              onChange={(next) =>
                change({ sites: draft.sites.map((one) => (one.key === site.key ? next : one)) })
              }
              onRemove={() => change({ sites: draft.sites.filter((one) => one.key !== site.key) })}
              onNewSecret={site.id === null ? async () => undefined : newSecret(site.id)}
            />
          ))}
          <Explained what="Adds an empty site to fill in. Core makes its bell secret when you save.">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                change({
                  sites: [
                    ...draft.sites,
                    {
                      key: newKey('site'),
                      id: null,
                      address: '',
                      bellPath: WORDPRESS_BELL,
                    },
                  ],
                })
              }
            >
              Add a site
            </Button>
          </Explained>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 border-t bg-background py-3">
        <Explained what="Saves everything on this page at once. A new connection starts loading its records; a removed connection or site goes, with its records or history.">
          <Button data-testid="save" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Explained>
      </div>
    </>
  );
}
