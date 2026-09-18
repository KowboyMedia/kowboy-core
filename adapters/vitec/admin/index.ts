// The Vitec adapter's own panels in the admin panel (docs/admin-panel.md): the webhook URL, the
// fetch list, the schedules per connection, and one record fetched on request, looked at or
// stored. Rendered by the engine's shell; nothing here knows the engine beyond the adapter API.
import { randomUUID } from 'node:crypto';
import * as connect from '../api.js';
import * as store from '../store.js';
import { mappers } from '../mappers.js';
import {
  DATATYPES,
  card,
  escape,
  field,
  form,
  grid,
  intro,
  kv,
  pill,
  pre,
  select,
  table,
  when,
  yesNo,
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
    const [catchUpAt, compareAt, until, pausedUntil, counts] = await Promise.all([
      store.getState(connection.id, 'catch_up_at'),
      store.getState(connection.id, 'compare_at'),
      store.getState(connection.id, 'catch_up_until'),
      store.getState(connection.id, 'paused_until'),
      store.summary(connection.licensedOffices),
    ]);
    const run = (action: string, label: string): string =>
      form('/admin/vitec', request.csrf, '', {
        submit: label,
        inline: true,
        hidden: { action, connection: connection.id },
      });
    const isPaused = Boolean(pausedUntil) && new Date(pausedUntil ?? 0).getTime() > Date.now();
    rows.push([
      `<code>${escape(connection.id)}</code>`,
      escape(connection.licensedOffices.join(', ')),
      yesNo(connection.active),
      isPaused
        ? `${pill('bad', 'paused')} <span class="text-secondary">until ${when(pausedUntil)}</span>`
        : pill('ok', 'fetching'),
      `${when(catchUpAt)}<br><span class="text-secondary">changes since ${when(until)}</span>`,
      when(compareAt),
      `${counts.waiting} waiting · ${counts.retrying} retrying · ${counts.givenUp} given up`,
      run('catch_up', 'Catch up now') +
        run('compare', 'Compare now') +
        (isPaused ? run('resume', 'Resume now') : ''),
    ]);
  }
  return table(
    [
      'Connection',
      'Offices',
      'Active',
      'State',
      'Last catch-up',
      'Last comparison',
      'Fetch list',
      'Run',
    ],
    rows,
    'No Vitec connections yet: add one under Connections.',
  );
}

async function blockedRows(request: AdminRequest): Promise<string> {
  const rows = (await store.blockedOffices()).map((office) => {
    const act = (action: string, label: string, danger = false): string =>
      form('/admin/vitec', request.csrf, '', {
        submit: label,
        inline: true,
        danger,
        hidden: { action, office: office.officeId },
      });
    return [
      escape(office.officeId),
      when(office.blockedAt),
      escape(office.reason),
      escape(office.probes),
      when(office.blockedUntil),
      act('probe', 'Probe now') + act('forget', 'Forget', true),
    ];
  });
  return table(
    ['Office', 'Refused since', 'What Vitec said', 'Failed probes', 'Next probe', 'Actions'],
    rows,
    'No office is refused: Vitec answers for every licensed office.',
  );
}

async function fetchListRows(request: AdminRequest): Promise<string> {
  const rows = (await store.entries(50)).map((entry) => {
    const act = (action: string, label: string, danger = false): string =>
      form('/admin/vitec', request.csrf, '', {
        submit: label,
        inline: true,
        danger,
        hidden: { action, office: entry.officeId, datatype: entry.datatype, id: entry.remoteId },
      });
    return [
      escape(entry.officeId),
      escape(entry.datatype),
      escape(entry.remoteId),
      escape(entry.reason),
      escape(entry.attempts),
      entry.nextAt ? when(entry.nextAt) : pill('bad', 'given up'),
      escape(entry.lastError ?? ''),
      act('retry', 'Retry now') + act('drop', 'Drop', true),
    ];
  });
  return table(
    ['Office', 'Datatype', 'Record', 'Reason', 'Attempts', 'Due', 'Last error', 'Actions'],
    rows,
    'The fetch list is empty: nothing is waiting to be fetched.',
  );
}

async function frontPage(request: AdminRequest): Promise<AdminResult> {
  const token = process.env['VITEC_WEBHOOK_TOKEN'];
  const webhook = token
    ? `<code>/v1/hook/vitec/webhook/${escape(token)}</code> on this app’s domain`
    : pill('bad', 'VITEC_WEBHOOK_TOKEN is not set; the listener answers 503');
  const html =
    intro(
      'Everything about the link to Vitec: where Vitec sends its notifications, when each connection last caught up and compared, and the records waiting to be fetched.',
    ) +
    card(
      'Notification URL',
      'Give this address to Vitec for the subscription. Vitec then calls it for every Update and Remove of an estate advertised on the website, and Core fetches or removes the record.',
      kv([
        ['URL', webhook],
        ['Vitec Connect', `<code>${escape(connect.baseUrl())}</code>`],
        ['Requests at once', escape(connect.concurrency())],
      ]),
    ) +
    card(
      'Connections and schedules',
      'A catch-up fetches everything that changed since the last one, in case a notification was missed; a comparison fetches Vitec’s list and removes what is no longer on it. Both run on their own; the buttons run them at the worker’s next tick.',
      await connectionRows(request),
    ) +
    card(
      'Refused offices',
      'An office Vitec answers 403 for is blocked at the first refusal: nothing is asked for it, its waiting records stay parked, and one probe per cool-down (an hour, doubling to a day) checks whether it is back; back means loaded again in full. "Probe now" asks at the worker\u2019s next tick; "Forget" drops the block without a probe, for an office that left the licence.',
      await blockedRows(request),
    ) +
    card(
      'Fetch list',
      'Records Core is about to fetch: notifications first, then loads and catch-ups. A retrying record failed and waits for its next attempt; after six failures it is given up, and Retry or Drop is yours. A connection that fails five times in a row pauses, two minutes doubling to thirty, and probes its way back.',
      (await fetchListRows(request)) +
        `<p class="mt-3 mb-0"><a href="/admin/vitec/fetch">Fetch one record by hand</a></p>`,
    );
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
  probe: async (form) => {
    if (form['office']) await store.expediteProbe(form['office']);
  },
  forget: async (form) => {
    if (form['office']) await store.unblockOffice(form['office']);
  },
  resume: async (form) => {
    const id = form['connection'];
    if (!id) return;
    await store.setState(id, 'paused_until', '');
    await store.setState(id, 'failures', '0');
  },
};

async function frontAction(request: AdminRequest): Promise<AdminResult> {
  await ACTIONS[request.form['action'] ?? '']?.(request.form);
  return { redirect: '/admin/vitec' };
}

// ---- One record: looked at (a dry run, nothing written) or queued for the worker ---------------

function fetchForm(request: AdminRequest, connections: Connection[]): string {
  const pick = (name: string): string => request.form[name] ?? '';
  return (
    intro(
      'Fetch one record from Vitec by hand: look at it without storing anything, or hand it to the worker to fetch and store like any notification.',
    ) +
    card(
      'One record',
      'Which record, and what to do with it.',
      form(
        '/admin/vitec/fetch',
        request.csrf,
        select(
          'connection',
          'Connection',
          connections.map((c) => ({ value: c.id })),
          pick('connection'),
          'Whose login to use at Vitec.',
        ) +
          select(
            'datatype',
            'Datatype',
            DATATYPES.map((d) => ({ value: d })),
            pick('datatype') || 'property',
          ) +
          field('office', 'Office', {
            value: pick('office'),
            required: true,
            help: 'The customer id Vitec gives the office, M30011 and the like.',
          }) +
          field('id', 'Record id', {
            value: pick('id'),
            required: true,
            help: 'The id Vitec uses for the record.',
          }) +
          select(
            'action',
            'Then',
            [
              { value: 'look', label: 'look: fetch and map it, write nothing' },
              { value: 'queue', label: 'queue: the worker fetches and stores it' },
            ],
            pick('action') || 'look',
          ),
        { submit: 'Go' },
      ),
    )
  );
}

async function look(
  credentials: Credentials,
  datatype: Datatype,
  office: string,
  id: string,
): Promise<string> {
  const raw = await connect.getOne(credentials, datatype, office, id);
  if (raw === null)
    return card('Answer', '', '<p class="bad mb-0">Vitec answers 404: no such record.</p>');
  const mapper = mappers[datatype];
  const mapped = mapper ? mapper(raw) : null;
  return (
    grid([
      card('Raw', 'The record as Vitec sent it.', pre(raw)),
      card(
        'Unified',
        'The same record in Core’s shape. Nothing was written.',
        pre(mapped?.data ?? {}),
      ),
    ]) +
    `<p class="text-secondary">Office ${escape(mapped?.officeId ?? '')} · changed in Vitec ${when(mapped?.remoteUpdatedAt)}.</p>`
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
    result = card(
      'Answer',
      '',
      '<p class="bad mb-0">A connection with a readable login, a datatype, an office and an id are needed.</p>',
    );
  } else if (request.form['action'] === 'queue') {
    await store.enqueue([
      { officeId: office, datatype, remoteId: id, reason: 'webhook', correlationId: randomUUID() },
    ]);
    result = card(
      'Answer',
      '',
      `<p class="mb-0">Queued ${escape(datatype)} ${escape(id)} of ${escape(office)}; the worker fetches it within seconds.</p>`,
    );
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
    return kv([
      ['Last catch-up', when(catchUpAt)],
      ['Last comparison', when(compareAt)],
      [
        'Fetch list',
        `${counts.waiting} waiting, ${counts.retrying} retrying, ${counts.givenUp} given up · <a href="/admin/vitec">the Vitec page</a>`,
      ],
    ]);
  },
};
