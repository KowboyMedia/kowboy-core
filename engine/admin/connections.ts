// Connections: a tenant's link to one CRM. The credentials form comes from the adapter and its
// values are never shown back; the lifecycle actions go through the same queue the admin API uses.
import {
  connections,
  setConnectionActive,
  setLicensedOffices,
  upsertConnection,
  type ConnectionListRow,
} from '../storage/connections.js';
import { queueLifecycle } from '../lifecycle.js';
import { queryEvents } from '../events.js';
import { DATATYPES, type Datatype, type LifecycleEvent } from '../adapter-api/types.js';
import { connectionStatus, credentialFields } from './adapters.js';
import {
  card,
  escape,
  field,
  form,
  grid,
  kv,
  link,
  pill,
  select,
  table,
  textarea,
  when,
  yesNo,
} from './html.js';
import { eventsTable } from './timeline.js';
import { officesOf, type Ctx, type Panel } from './context.js';

const ID = /^[a-z0-9_-]{1,64}$/;
const EVENTS: LifecycleEvent['type'][] = [
  'connection_added',
  'offices_added',
  'offices_removed',
  'resync',
  'connection_removed',
];

const href = (id: string): string => `/admin/connections/${encodeURIComponent(id)}`;

const loginPill = (row: ConnectionListRow): string =>
  row.has_credentials ? pill('ok', 'set') : pill('bad', 'missing');

/** A tenant's connections as a table, on the tenant's page. */
export function connectionTable(rows: ConnectionListRow[]): string {
  return table(
    ['Connection', 'CRM', 'Offices', 'Active', 'Login', 'Last ingest', 'Last error'],
    rows.map((row) => [
      link(href(row.id), row.id),
      escape(row.provider),
      escape(row.licensed_offices.join(', ')),
      yesNo(row.active),
      loginPill(row),
      when(row.last_ingest_at),
      row.last_error ? `<span class="bad">${escape(row.last_error)}</span>` : '',
    ]),
    'No connections yet.',
  );
}

/** The form that makes a connection for one tenant, on the tenant's page. */
export function addConnectionForm(ctx: Ctx, tenantId: string): string {
  const providers = ctx.adapters.map((adapter) => ({ value: adapter.provider }));
  return form(
    '/admin/connections',
    ctx.csrf,
    field('id', 'Connection id', {
      required: true,
      placeholder: 'acme-1',
      help: 'Short, lowercase and permanent: letters, digits, - and _.',
    }) +
      select('provider', 'CRM', providers, undefined, 'The adapter that talks to this CRM.') +
      textarea(
        'offices',
        'Licensed offices',
        '',
        'The office ids this tenant is licensed for, one per line or comma-separated. Core keeps records of these offices only.',
      ),
    { submit: 'Add connection', hidden: { tenant: tenantId } },
  );
}

async function detailPage(ctx: Ctx, row: ConnectionListRow): Promise<string> {
  const fields = credentialFields(ctx.adapters, row.provider);
  const credentials =
    fields.length === 0
      ? '<p class="muted">This CRM needs no login.</p>'
      : fields
          .map((f) =>
            field(`credential_${f.key}`, f.label, { type: f.secret ? 'password' : 'text' }),
          )
          .join('') +
        `<p class="muted">The login is ${row.has_credentials ? 'set' : 'missing'}. It is stored encrypted and never shown again; leave the fields empty to keep it.</p>`;
  const save = form(
    href(row.id),
    ctx.csrf,
    credentials +
      textarea(
        'offices',
        'Licensed offices',
        row.licensed_offices.join('\n'),
        'One office id per line. Adding an office here does not fetch it: use "Load added offices" below.',
      ) +
      select(
        'active',
        'Active',
        [{ value: 'yes' }, { value: 'no' }],
        row.active ? 'yes' : 'no',
        'An inactive connection is left alone: nothing is fetched, and its records stay as they are.',
      ),
    { submit: 'Save' },
  );
  const action = (
    event: LifecycleEvent['type'],
    inner: string,
    submit: string,
    danger = false,
  ): string =>
    form(`${href(row.id)}/event`, ctx.csrf, inner, { submit, hidden: { event }, danger });
  const actions = grid([
    card(
      'Load everything',
      'Fetches every record of the licensed offices, and whatever they refer to. Use it after adding the connection, or when in doubt.',
      action('connection_added', '', 'Load everything'),
    ),
    card(
      'Load added offices',
      'Fetches the records of offices you just added to the licence, and nothing else.',
      action(
        'offices_added',
        field('office_ids', 'Office ids', { help: 'Comma-separated.' }),
        'Load these offices',
      ),
    ),
    card(
      'Remove offices',
      'Takes these offices off the licence and their records off the sites.',
      action(
        'offices_removed',
        field('office_ids', 'Office ids', { help: 'Comma-separated.' }),
        'Remove these offices',
        true,
      ),
    ),
    card(
      'Resync',
      'Fetches the CRM’s list again and removes from the sites what is no longer on it. One datatype, or all.',
      action(
        'resync',
        select('datatype', 'Datatype', [
          { value: '', label: 'all' },
          ...DATATYPES.map((d) => ({ value: d })),
        ]),
        'Resync',
      ),
    ),
    card(
      'Remove everything',
      'Takes every record of this connection off the sites and switches the connection off. The records stay for 90 days as tombstones.',
      action('connection_removed', '', 'Remove everything', true),
    ),
  ]);
  const status = await connectionStatus(ctx.adapters, row.provider, row.id);
  const events = await queryEvents({ connectionId: row.id, limit: 20, newestFirst: true });
  return (
    card(
      'About this connection',
      'What it links, and when it last brought something in.',
      kv([
        ['Tenant', link(`/admin/tenants/${encodeURIComponent(row.tenant_id)}`, row.tenant_id)],
        ['CRM', escape(row.provider)],
        ['Active', yesNo(row.active)],
        ['Login', loginPill(row)],
        ['Last ingest', when(row.last_ingest_at)],
        [
          'Last error',
          row.last_error
            ? `<span class="bad">${escape(row.last_error)}</span>`
            : '<span class="muted">none</span>',
        ],
      ]),
    ) +
    card('Login and offices', 'How Core reaches this CRM, and which offices it keeps.', save) +
    actions +
    (status
      ? card(
          'What the adapter knows',
          'Schedules and the fetch list for this connection, as its adapter reports them.',
          status,
        )
      : '') +
    card('Latest events', 'The 20 newest events of this connection.', eventsTable(events))
  );
}

const rowOf = async (id: string): Promise<ConnectionListRow | undefined> =>
  (await connections()).find((row) => row.id === id);

async function saveConnection(ctx: Ctx, row: ConnectionListRow): Promise<string | null> {
  const fields = credentialFields(ctx.adapters, row.provider);
  const values = fields.map((f) => [f.key, ctx.form[`credential_${f.key}`] ?? ''] as const);
  const given = values.filter(([, value]) => value !== '');
  if (given.length > 0 && given.length < values.length) {
    return `!Fill in every credential field (${fields.map((f) => f.label).join(', ')}) or none.`;
  }
  await upsertConnection({
    id: row.id,
    tenantId: row.tenant_id,
    provider: row.provider,
    credentials: given.length > 0 ? JSON.stringify(Object.fromEntries(values)) : null,
    licensedOffices: officesOf(ctx.form['offices'] ?? ''),
    active: ctx.form['active'] === 'yes',
  });
  return null;
}

export const connectionPanels: Panel[] = [
  {
    method: 'POST',
    pattern: /^\/admin\/connections$/,
    handle: async (ctx) => {
      const id = ctx.form['id'] ?? '';
      const tenantId = ctx.form['tenant'] ?? '';
      const provider = ctx.form['provider'] ?? '';
      const back = tenantId ? `/admin/tenants/${encodeURIComponent(tenantId)}` : '/admin/tenants';
      if (!ID.test(id) || !tenantId || !ctx.adapters.some((a) => a.provider === provider)) {
        return ctx.redirect(back, '!A connection needs an id like acme-1, a tenant and a CRM.');
      }
      if (await rowOf(id)) return ctx.redirect(back, `!There is already a connection ${id}.`);
      await upsertConnection({
        id,
        tenantId,
        provider,
        licensedOffices: officesOf(ctx.form['offices'] ?? ''),
      });
      return ctx.redirect(href(id), 'Connection created. Now its login, then "Load everything".');
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/connections\/([^/]+)$/,
    handle: async (ctx) => {
      const row = await rowOf(ctx.params[0] ?? '');
      if (!row) return { ...ctx.render('Not found', '<p>No such connection.</p>'), status: 404 };
      return ctx.render(`Connection ${row.id}`, await detailPage(ctx, row));
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/connections\/([^/]+)$/,
    handle: async (ctx) => {
      const row = await rowOf(ctx.params[0] ?? '');
      if (!row) return ctx.redirect('/admin/connections', '!No such connection.');
      const problem = await saveConnection(ctx, row);
      return ctx.redirect(href(row.id), problem ?? 'Saved.');
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/connections\/([^/]+)\/event$/,
    handle: async (ctx) => {
      const id = ctx.params[0] ?? '';
      const event = EVENTS.find((candidate) => candidate === ctx.form['event']);
      if (!event) return ctx.redirect(href(id), '!Unknown action.');
      const datatype = DATATYPES.find((candidate) => candidate === ctx.form['datatype']) as
        Datatype | undefined;
      const queued = await queueLifecycle(id, event, {
        officeIds: officesOf(ctx.form['office_ids'] ?? ''),
        datatype,
      });
      if (queued === null) return ctx.redirect('/admin/connections', '!No such connection.');
      if (event === 'connection_removed' || event === 'offices_removed') {
        if (event === 'connection_removed') await setConnectionActive(id, false);
        else
          await setLicensedOffices(
            id,
            (await rowOf(id))?.licensed_offices.filter(
              (o) => !officesOf(ctx.form['office_ids'] ?? '').includes(o),
            ) ?? [],
          );
      }
      return ctx.redirect(href(id), `Queued ${event}; the worker delivers it within seconds.`);
    },
  },
];
