// The Vitec adapter's own panels in the admin panel (docs/admin-panel.md): the webhook URL, the
// fetch list, the schedules per connection, and one record fetched on request, looked at or
// stored. Rendered by the engine's shell; nothing here knows the engine beyond the adapter API.
import { randomUUID } from 'node:crypto';
import * as connect from '../api.js';
import * as store from '../store.js';
import { mappers } from '../mappers.js';
import {
  DATATYPES,
  escape,
  field,
  form,
  pre,
  select,
  table,
  when,
  type AdapterAdmin,
  type AdminRequest,
  type AdminResult,
  type Connection,
  type Datatype,
} from '../../../engine/adapter-api/index.js';

type Credentials = { username: string; password: string };

const credentialsOf = (connection: Connection): Credentials | null => {
  try {
    const parsed = JSON.parse(connection.credentials ?? '') as Partial<Credentials>;
    return typeof parsed.username === 'string' && typeof parsed.password === 'string'
      ? { username: parsed.username, password: parsed.password }
      : null;
  } catch {
    return null;
  }
};

const datatypeOf = (value: string | undefined): Datatype | undefined =>
  DATATYPES.find((candidate) => candidate === value);

/** The reset that makes the worker's next tick run a schedule now. */
const LONG_AGO = '1970-01-01T00:00:00.000Z';

// ---- Front page: webhook, schedules, the fetch list ------------------------------------------

async function connectionRows(request: AdminRequest): Promise<string> {
  const rows: string[][] = [];
  for (const connection of await request.connections()) {
    const [catchUpAt, compareAt, until, counts] = await Promise.all([
      store.getState(connection.id, 'catch_up_at'),
      store.getState(connection.id, 'compare_at'),
      store.getState(connection.id, 'catch_up_until'),
      store.summary(connection.licensedOffices),
    ]);
    const run = (action: string, label: string): string =>
      form('/admin/vitec', request.csrf, '', {
        submit: label,
        inline: true,
        hidden: { action, connection: connection.id },
      });
    rows.push([
      escape(connection.id),
      escape(connection.licensedOffices.join(', ')),
      escape(connection.active ? 'yes' : 'no'),
      `${when(catchUpAt)}<br><span class="muted">window until ${when(until)}</span>`,
      when(compareAt),
      `${counts.waiting} waiting · ${counts.retrying} retrying · ${counts.givenUp} given up`,
      run('catch_up', 'Catch up now') + run('compare', 'Compare now'),
    ]);
  }
  return table(
    ['Connection', 'Offices', 'Active', 'Last catch-up', 'Last comparison', 'Fetch list', 'Run'],
    rows,
    'No Vitec connections yet.',
  );
}

async function fetchListRows(request: AdminRequest): Promise<string> {
  const rows = (await store.entries(50)).map((entry) => {
    const act = (action: string, label: string): string =>
      form('/admin/vitec', request.csrf, '', {
        submit: label,
        inline: true,
        hidden: { action, office: entry.officeId, datatype: entry.datatype, id: entry.remoteId },
      });
    return [
      escape(entry.officeId),
      escape(entry.datatype),
      escape(entry.remoteId),
      escape(entry.reason),
      escape(entry.attempts),
      entry.nextAt ? when(entry.nextAt) : '<span class="bad">given up</span>',
      escape(entry.lastError ?? ''),
      act('retry', 'Retry now') + act('drop', 'Drop'),
    ];
  });
  return table(
    ['Office', 'Datatype', 'Record', 'Reason', 'Attempts', 'Due', 'Last error', 'Actions'],
    rows,
    'The fetch list is empty.',
  );
}

async function frontPage(request: AdminRequest): Promise<AdminResult> {
  const token = process.env['VITEC_WEBHOOK_TOKEN'];
  const webhook = token
    ? `<code>/v1/hook/vitec/webhook/${escape(token)}</code> on this app's domain`
    : '<span class="bad">VITEC_WEBHOOK_TOKEN is not set; the listener answers 503</span>';
  const html =
    `<p>Notification URL for Vitec: ${webhook}. Requests at once: ${escape(connect.concurrency())}. ` +
    `Connect: <code>${escape(connect.baseUrl())}</code>.</p>` +
    '<h2>Connections and schedules</h2>' +
    (await connectionRows(request)) +
    '<h2>Fetch list</h2>' +
    (await fetchListRows(request)) +
    '<p><a href="/admin/vitec/fetch">Fetch one record</a></p>';
  return { html };
}

/** The record a fetch-list button names, when the form is complete. */
const target = (form: Record<string, string>): [string, Datatype, string] | null => {
  const datatype = datatypeOf(form['datatype']);
  const office = form['office'];
  const id = form['id'];
  return office && datatype && id ? [office, datatype, id] : null;
};

/** What the front page's buttons do; a schedule is run by making it overdue for the worker's next tick. */
const ACTIONS: Record<string, (form: Record<string, string>) => Promise<void>> = {
  catch_up: async (form) => {
    if (form['connection']) await store.setState(form['connection'], 'catch_up_at', LONG_AGO);
  },
  compare: async (form) => {
    if (form['connection']) await store.setState(form['connection'], 'compare_at', LONG_AGO);
  },
  retry: async (form) => {
    const record = target(form);
    if (record) await store.expediteOne(...record);
  },
  drop: async (form) => {
    const record = target(form);
    if (record) await store.drop(...record);
  },
};

async function frontAction(request: AdminRequest): Promise<AdminResult> {
  await ACTIONS[request.form['action'] ?? '']?.(request.form);
  return { redirect: '/admin/vitec' };
}

// ---- One record: looked at (a dry run, nothing written) or queued for the worker ---------------

function fetchForm(request: AdminRequest, connections: Connection[]): string {
  const pick = (name: string): string => request.form[name] ?? '';
  return form(
    '/admin/vitec/fetch',
    request.csrf,
    select(
      'connection',
      'Connection',
      connections.map((c) => ({ value: c.id })),
      pick('connection'),
    ) +
      select(
        'datatype',
        'Datatype',
        DATATYPES.map((d) => ({ value: d })),
        pick('datatype') || 'property',
      ) +
      field('office', 'Office (customer id, M30011 and the like)', {
        value: pick('office'),
        required: true,
      }) +
      field('id', 'Record id', { value: pick('id'), required: true }) +
      select(
        'action',
        'Then',
        [
          { value: 'look', label: 'look: fetch and map, write nothing' },
          { value: 'queue', label: 'queue: the worker fetches and stores it' },
        ],
        pick('action') || 'look',
      ),
    { submit: 'Go' },
  );
}

async function look(
  credentials: Credentials,
  datatype: Datatype,
  office: string,
  id: string,
): Promise<string> {
  const raw = await connect.getOne(credentials, datatype, office, id);
  if (raw === null) return '<p class="bad">Vitec answers 404: no such record.</p>';
  const mapper = mappers[datatype];
  const mapped = mapper ? mapper(raw) : null;
  return (
    `<div class="columns"><div><h2>Raw</h2>${pre(raw)}</div><div><h2>Unified</h2>${pre(mapped?.data ?? {})}</div></div>` +
    `<p class="muted">office_id ${escape(mapped?.officeId ?? '')} · remote_updated_at ${escape(mapped?.remoteUpdatedAt ?? '')}. Nothing was written.</p>`
  );
}

async function fetchPage(request: AdminRequest): Promise<AdminResult> {
  const connections = await request.connections();
  if (request.method !== 'POST') return { html: fetchForm(request, connections) };
  const connection = connections.find((c) => c.id === request.form['connection']);
  const credentials = connection ? credentialsOf(connection) : null;
  const datatype = datatypeOf(request.form['datatype']);
  const office = request.form['office'] ?? '';
  const id = request.form['id'] ?? '';
  let result: string;
  if (!credentials || !datatype || !office || !id) {
    result =
      '<p class="bad">A connection with readable credentials, a datatype, an office and an id are needed.</p>';
  } else if (request.form['action'] === 'queue') {
    await store.enqueue([
      { officeId: office, datatype, remoteId: id, reason: 'webhook', correlationId: randomUUID() },
    ]);
    result = `<p>Queued ${escape(datatype)} ${escape(id)} of ${escape(office)}; the worker fetches it within seconds.</p>`;
  } else {
    result = await look(credentials, datatype, office, id);
  }
  return { html: fetchForm(request, connections) + result };
}

export const vitecAdmin: AdapterAdmin = {
  credentials: [
    { key: 'username', label: 'Connect username' },
    { key: 'password', label: 'Connect password', secret: true },
  ],
  panels: [
    {
      path: '',
      title: 'Vitec',
      handle: (request) => (request.method === 'POST' ? frontAction(request) : frontPage(request)),
    },
    { path: 'fetch', title: 'Vitec: fetch one record', handle: fetchPage },
  ],
  async connectionStatus(connection) {
    const [catchUpAt, compareAt, counts] = await Promise.all([
      store.getState(connection.id, 'catch_up_at'),
      store.getState(connection.id, 'compare_at'),
      store.summary(connection.licensedOffices),
    ]);
    return `<p>Last catch-up ${when(catchUpAt)} · last comparison ${when(compareAt)} · fetch list: ${counts.waiting} waiting, ${counts.retrying} retrying, ${counts.givenUp} given up. <a href="/admin/vitec">Vitec panel</a>.</p>`;
  },
};
