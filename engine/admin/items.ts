// Items: the records Core holds. Their numbers, a search with filters, actions on a selection,
// the live activity of the write path, and one record's three faces with its timeline.
import { findItems, itemCounts, type ItemRow } from '../storage/items.js';
import { queryEvents } from '../events.js';
import { recompute, type ImpactReport } from '../recompute.js';
import { connections, tenants } from '../storage/connections.js';
import { DATATYPES, type Datatype } from '../adapter-api/types.js';
import { figure, tile, tiles } from './charts.js';
import { activity, countsSince, HOURS, type ActivityRow } from './stats.js';
import { HTML } from './auth.js';
import {
  card,
  escape,
  field,
  form,
  grid,
  intro,
  json,
  kv,
  link,
  select,
  startOfDay,
  when,
  yesNo,
} from './html.js';
import { eventsTable } from './timeline.js';
import { numberOf, type Ctx, type Panel } from './context.js';
import type { Response } from '../http/server.js';

type Key = { connection_id: string; datatype: string; remote_id: string };

const enc = encodeURIComponent;
const keyOf = (row: Key): string => `${row.connection_id}/${row.datatype}/${row.remote_id}`;
const itemHref = (row: Key): string =>
  `/admin/items/${enc(row.connection_id)}/${enc(row.datatype)}/${enc(row.remote_id)}`;

const datatypeOf = (value: string | undefined): Datatype | undefined =>
  DATATYPES.find((candidate) => candidate === value);

/** How often the live activity list asks for fresh rows. */
const LIVE_EVERY_MS = 5_000;

// ---- The numbers -------------------------------------------------------------------------------

async function figures(): Promise<string> {
  const [counts, since] = await Promise.all([itemCounts(), countsSince()]);
  const total = (key: 'live' | 'tombstoned'): number =>
    counts.reduce((sum, row) => sum + Number(row[key]), 0);
  const n = (type: string): number => since.get(type) ?? 0;
  return tiles([
    tile('Live records', figure(total('live')), {
      context: `${figure(total('tombstoned'))} removed`,
    }),
    tile(`Written, last ${HOURS} h`, figure(n('entity.written')), {
      context: `${figure(n('entity.unchanged'))} fetched unchanged`,
    }),
    tile(`Removed, last ${HOURS} h`, figure(n('entity.tombstoned')), {
      context: 'gone from the CRM',
    }),
    tile(`Dropped, last ${HOURS} h`, figure(n('entity.dropped')), {
      state: n('entity.dropped') > 0 ? 'bad' : 'ok',
      context: 'malformed or unlicensed',
    }),
    tile(`Applied by sites, last ${HOURS} h`, figure(n('site.applied'))),
    tile(`Failed at sites, last ${HOURS} h`, figure(n('site.failed')), {
      state: n('site.failed') > 0 ? 'bad' : 'ok',
    }),
  ]);
}

// ---- The search ---------------------------------------------------------------------------------

type Filters = {
  tenant?: number;
  connection?: string;
  datatype?: Datatype;
  office?: string;
  id?: string;
  from?: string;
  to?: string;
  removed?: 'yes' | 'no';
  limit: number;
};

/** The day after a `YYYY-MM-DD` day, so a "to" day is included whole. */
const dayAfter = (day: string): string => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const isDay = (value: string | undefined): value is string =>
  value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);

function filtersOf(query: URLSearchParams): Filters {
  const value = (name: string): string | undefined => query.get(name)?.trim() || undefined;
  const removed = value('removed');
  return {
    tenant: numberOf(value('tenant')),
    connection: value('connection'),
    datatype: datatypeOf(value('datatype')),
    office: value('office'),
    id: value('id'),
    from: isDay(value('from')) ? value('from') : undefined,
    to: isDay(value('to')) ? value('to') : undefined,
    removed: removed === 'yes' || removed === 'no' ? removed : undefined,
    limit: Math.min(numberOf(value('limit')) ?? 100, 500),
  };
}

async function searchForm(filters: Filters, query: URLSearchParams): Promise<string> {
  const [tenantRows, connectionRows] = await Promise.all([tenants(), connections()]);
  const any = { value: '', label: 'any' };
  const current = (name: string): string => query.get(name) ?? '';
  const col = (inner: string): string => `<div class="col-6 col-md-4 col-xl-2">${inner}</div>`;
  return (
    `<form method="get" action="/admin/items"><div class="row g-2">` +
    col(
      select(
        'tenant',
        'Tenant',
        [
          any,
          ...tenantRows.map((row) => ({
            value: String(row.id),
            label: `#${row.id} ${row.display_name}`,
          })),
        ],
        current('tenant'),
      ),
    ) +
    col(
      select(
        'connection',
        'Connection',
        [any, ...connectionRows.map((row) => ({ value: row.id }))],
        current('connection'),
      ),
    ) +
    col(
      select(
        'datatype',
        'Entity type',
        [any, ...DATATYPES.map((d) => ({ value: d }))],
        current('datatype'),
      ),
    ) +
    col(field('office', 'Office', { value: current('office'), placeholder: 'M30011' })) +
    col(field('id', 'Record id', { value: current('id'), placeholder: 'as the CRM names it' })) +
    col(
      select(
        'removed',
        'Removed',
        [
          any,
          { value: 'no', label: 'no: live records' },
          { value: 'yes', label: 'yes: removed in the CRM' },
        ],
        current('removed'),
      ),
    ) +
    col(field('from', 'Written from', { type: 'date', value: filters.from ?? '' })) +
    col(
      field('to', 'Written to', {
        type: 'date',
        value: filters.to ?? '',
        help: 'Both days included, in Swedish time.',
      }),
    ) +
    col(
      field('limit', 'At most', {
        type: 'number',
        value: String(filters.limit),
        help: 'Newest first, up to 500.',
      }),
    ) +
    `<div class="col-6 col-md-4 col-xl-2 d-flex align-items-start pt-4"><button class="btn btn-primary mt-1">Find</button></div>` +
    `</div></form>`
  );
}

/** The results, each with a box to tick, and what can be done with the ticked ones. */
function results(ctx: Ctx, rows: ItemRow[], back: string): string {
  if (rows.length === 0) return `<p class="text-secondary mb-0">Nothing matches.</p>`;
  const body = rows
    .map(
      (row) =>
        `<tr><td><input class="form-check-input" type="checkbox" name="key" value="${escape(keyOf(row))}" aria-label="Select ${escape(row.remote_id)}"></td>` +
        `<td>${escape(row.datatype)}</td><td>${escape(row.connection_id)}</td><td>${link(itemHref(row), row.remote_id)}</td>` +
        `<td>${escape(row.office_id ?? '')}</td><td class="tabular">${escape(row.seq)}</td><td>${yesNo(row.deleted)}</td><td>${when(row.updated_at)}</td></tr>`,
    )
    .join('');
  const all = `<input class="form-check-input" type="checkbox" aria-label="Select all" onclick="for (const box of this.form.querySelectorAll('input[name=key]')) box.checked = this.checked">`;
  return (
    `<form method="post" action="/admin/items/recompute"><input type="hidden" name="csrf" value="${escape(ctx.csrf)}"><input type="hidden" name="back" value="${escape(back)}">` +
    `<div class="table-responsive"><table class="table table-vcenter"><thead><tr><th>${all}</th><th>Entity type</th><th>Connection</th><th>Record id</th><th>Office</th><th>Seq</th><th>Removed</th><th>Written</th></tr></thead><tbody>${body}</tbody></table></div>` +
    `<div class="d-flex flex-wrap align-items-center gap-3 mt-3"><span class="text-secondary small">With the ticked records:</span><button class="btn btn-primary">Recompute selected</button>` +
    `<span class="text-secondary small">“Update from CRM” for a selection comes with the adapter capability of register question 57.</span></div></form>`
  );
}

// ---- The live activity list -------------------------------------------------------------------------

type State = 'queued' | 'fetched' | 'applied' | 'error';

/** Whole rows carry the state; the word in the row says it too, so colour is never alone. */
const STATES: Record<State, { row: string; key: string; word: string; note: string }> = {
  queued: {
    row: 'table-warning',
    key: 'bg-warning-lt',
    word: 'queued',
    note: 'waiting to be fetched',
  },
  fetched: {
    row: 'table-info',
    key: 'bg-info-lt',
    word: 'fetched',
    note: 'through the write path',
  },
  applied: {
    row: 'table-success',
    key: 'bg-success-lt',
    word: 'applied',
    note: 'a site applied it',
  },
  error: {
    row: 'table-danger',
    key: 'bg-danger-lt',
    word: 'error',
    note: 'dropped, or a site could not apply it',
  },
};

const stateOf = (row: ActivityRow): State =>
  row.type === 'entity.dropped' || row.site_type === 'site.failed'
    ? 'error'
    : row.site_type === 'site.applied'
      ? 'applied'
      : 'fetched';

function what(row: ActivityRow): string {
  const fields = row.fields;
  switch (row.type) {
    case 'entity.written':
      return `written, seq ${escape(fields['seq'])}${fields['cause'] === 'recompute' ? ' (recompute)' : ''}`;
    case 'entity.unchanged':
      return 'fetched, unchanged';
    case 'entity.tombstoned':
      return 'removed';
    default:
      return `dropped: ${escape(fields['reason'])}${fields['detail'] ? ` (${escape(fields['detail'])})` : ''}`;
  }
}

const site = (row: ActivityRow): string =>
  row.site_type
    ? `${escape(row.site_client ?? 'a site')} ${row.site_type === 'site.applied' ? 'applied' : 'failed'} ${when(row.site_at)}${row.site_detail ? ` <span class="text-secondary">${escape(row.site_detail)}</span>` : ''}`
    : '';

/** The rows alone: what the page shows first and what it fetches again every few seconds. */
export function activityRows(rows: ActivityRow[]): string {
  if (rows.length === 0)
    return `<tr><td colspan="9" class="text-secondary">Nothing has gone through the write path yet.</td></tr>`;
  return rows
    .map((row) => {
      const state = stateOf(row);
      return (
        `<tr class="${STATES[state].row}" data-key="${escape(`${row.at.toISOString()}/${keyOf(row)}`)}" data-state="${state}">` +
        `<td>${when(row.at)}</td><td><span class="badge bg-secondary-lt">${STATES[state].word}</span></td>` +
        `<td>${escape(row.tenant_id ?? '')}</td><td>${escape(row.office_id ?? '')}</td><td>${escape(row.datatype)}</td>` +
        `<td>${link(itemHref(row), row.remote_id)}</td><td>${what(row)}</td><td>${site(row)}</td>` +
        `<td>${row.correlation_id ? link(`/admin/events?correlation=${enc(row.correlation_id)}`, row.correlation_id.slice(0, 8)) : ''}</td></tr>`
      );
    })
    .join('');
}

const LIVE_SCRIPT =
  `<script>(function(){var body=document.getElementById('activity');var dot=document.getElementById('activity-dot');if(!body||!dot)return;` +
  `function seen(){var s={};body.querySelectorAll('tr[data-key]').forEach(function(r){s[r.dataset.key+'|'+r.dataset.state]=1});return s}` +
  `function tick(){fetch('/admin/items/activity',{credentials:'same-origin'}).then(function(r){if(!r.ok)throw r.status;return r.text()}).then(function(html){` +
  `var before=seen();var doc=new DOMParser().parseFromString('<table><tbody>'+html+'</tbody></table>','text/html');var rows=doc.querySelector('tbody');if(!rows)return;` +
  `rows.querySelectorAll('tr[data-key]').forEach(function(r){if(!before[r.dataset.key+'|'+r.dataset.state])r.classList.add('activity-new')});` +
  `body.replaceChildren.apply(body,Array.prototype.slice.call(rows.childNodes));dot.className='status-dot status-dot-animated bg-green';dot.title='Updated '+new Date().toLocaleTimeString('sv-SE')})` +
  `.catch(function(){dot.className='status-dot bg-red';dot.title='The last update failed; trying again'})}` +
  `setInterval(tick,${LIVE_EVERY_MS})})();</script>`;

function activityCard(rows: ActivityRow[]): string {
  const legend = (Object.keys(STATES) as State[])
    .map(
      (state) =>
        `<span class="me-3"><span class="badge ${STATES[state].key}" style="width:1rem;height:1rem;vertical-align:-2px"></span> <strong>${STATES[state].word}</strong> <span class="text-secondary">${STATES[state].note}${state === 'queued' ? '; shown once the adapter hands over its queue (register question 57)' : ''}</span></span>`,
    )
    .join('');
  const inner =
    `<div class="d-flex flex-wrap align-items-center small mb-2"><span class="me-3"><span class="status-dot status-dot-animated bg-green" id="activity-dot" title="Refreshes every ${LIVE_EVERY_MS / 1000} seconds"></span> live, every ${LIVE_EVERY_MS / 1000} s</span>${legend}</div>` +
    `<div class="table-responsive"><table class="table table-vcenter table-sm"><thead><tr><th>When</th><th>State</th><th>Tenant</th><th>Office</th><th>Entity type</th><th>Record</th><th>What</th><th>Site</th><th>Correlation</th></tr></thead><tbody id="activity">${activityRows(rows)}</tbody></table></div>` +
    LIVE_SCRIPT;
  return card(
    'Live activity',
    'The last 100 records through the write path, newest first, as they arrive: fetched from the CRM, then applied by a site, or in error. The whole row carries the state.',
    inner,
  );
}

// ---- One record ----------------------------------------------------------------------------------

function itemPage(ctx: Ctx, row: ItemRow, events: Awaited<ReturnType<typeof queryEvents>>): string {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const { display, ...unified } = data;
  const about = card(
    'About this record',
    'Where it comes from, its place in the change sequence, and when it was last written.',
    kv([
      ['Tenant', `<code>${escape(row.tenant_id)}</code>`],
      ['Connection', escape(row.connection_id)],
      ['Office', escape(row.office_id ?? '')],
      ['Seq', escape(row.seq)],
      ['Removed', yesNo(row.deleted)],
      ['Content hash', `<code>${escape(row.content_hash)}</code>`],
      ['Changed in the CRM', when(row.remote_updated_at)],
      ['Written in Core', when(row.updated_at)],
      ['Rules version', escape(row.rules_version)],
    ]),
  );
  const faces = grid([
    card('Raw', 'The record exactly as the CRM sent it.', json(row.raw)),
    card('Unified', 'The same record in Core’s one shape, whatever the CRM.', json(unified)),
    card('Display', 'The values the sites show, computed by the rules.', json(display ?? {})),
  ]);
  const actions = card(
    'Recompute',
    'Runs the mapping and the rules again over the stored raw record. Nothing is asked of the CRM.',
    form(`${itemHref(row)}/recompute`, ctx.csrf, '', { submit: 'Recompute this record' }),
  );
  return (
    about +
    faces +
    actions +
    card(
      'Timeline',
      'Everything that happened to this record, newest first: notifications, fetches, writes, bells, what the sites applied.',
      eventsTable(events),
    )
  );
}

/** Several records recomputed, their reports added up. */
async function recomputeMany(keys: string[]): Promise<ImpactReport> {
  const total: ImpactReport = {
    examined: 0,
    changed: 0,
    unchanged: 0,
    failed: 0,
    failures: [],
    examples: [],
  };
  for (const key of keys) {
    const [connectionId, datatype, remoteId] = key.split('/');
    const kind = datatypeOf(datatype);
    if (!connectionId || !kind || !remoteId) continue;
    const report = await recompute({ connectionId, datatype: kind, remoteId });
    total.examined += report.examined;
    total.changed += report.changed;
    total.unchanged += report.unchanged;
    total.failed += report.failed;
    total.failures.push(...report.failures);
    total.examples.push(...report.examples.slice(0, 10 - total.examples.length));
  }
  return total;
}

const resultPage = (ctx: Ctx, title: string, report: ImpactReport, back: string): Response =>
  ctx.render(
    title,
    card(
      'Result',
      'How many records were examined and changed, and any failures.',
      json(report) + `<p>${link(back, 'Back')}</p>`,
    ),
  );

export const itemPanels: Panel[] = [
  {
    method: 'GET',
    pattern: /^\/admin\/items$/,
    handle: async (ctx) => {
      const query = ctx.request.query;
      const filters = filtersOf(query);
      // The form always sends the datatype, "any" included: a submitted form is a search.
      const searched = query.has('datatype');
      const rows = searched
        ? await findItems({
            tenantId: filters.tenant,
            datatype: filters.datatype,
            remoteId: filters.id,
            officeId: filters.office,
            connectionId: filters.connection,
            writtenFrom: filters.from ? startOfDay(filters.from) : undefined,
            writtenTo: filters.to ? startOfDay(dayAfter(filters.to)) : undefined,
            deleted: filters.removed === undefined ? undefined : filters.removed === 'yes',
            limit: filters.limit,
          })
        : [];
      const back = `/admin/items${query.size ? `?${query}` : ''}`;
      const body =
        intro(
          'The records Core holds: their numbers, a search, what can be done with a selection, and what is going through the write path right now.',
        ) +
        (await figures()) +
        card(
          'Find records',
          'Any field narrows the search; leave the rest empty.',
          await searchForm(filters, query),
        ) +
        (searched
          ? card(
              'Results',
              `The newest ${filters.limit} at most. Tick records to act on them.`,
              results(ctx, rows, back),
            )
          : '') +
        activityCard(await activity());
      return ctx.render('Items', body);
    },
  },
  {
    // The live list's rows alone, for the page's script.
    method: 'GET',
    pattern: /^\/admin\/items\/activity$/,
    handle: async () => ({ status: 200, headers: HTML, body: activityRows(await activity()) }),
  },
  {
    method: 'POST',
    pattern: /^\/admin\/items\/recompute$/,
    handle: async (ctx) => {
      const keys = new URLSearchParams(ctx.request.body.toString('utf8')).getAll('key');
      const back = ctx.form['back']?.startsWith('/admin/items') ? ctx.form['back'] : '/admin/items';
      if (keys.length === 0) return ctx.redirect(back, '!Tick at least one record.');
      return resultPage(
        ctx,
        `Recomputed ${keys.length} record(s)`,
        await recomputeMany(keys),
        back,
      );
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/items\/([^/]+)\/([^/]+)\/([^/]+)$/,
    handle: async (ctx) => {
      const [connectionId, datatype, remoteId] = ctx.params;
      const kind = datatypeOf(datatype);
      const row = kind
        ? (await findItems({ connectionId, datatype: kind, remoteId, limit: 1 }))[0]
        : undefined;
      if (!row) return { ...ctx.render('Not found', '<p>No such item.</p>'), status: 404 };
      const events = await queryEvents({
        entity: {
          connectionId: row.connection_id,
          datatype: row.datatype,
          remoteId: row.remote_id,
        },
        limit: 100,
        newestFirst: true,
      });
      return ctx.render(`${row.datatype} ${row.remote_id}`, itemPage(ctx, row, events));
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/items\/([^/]+)\/([^/]+)\/([^/]+)\/recompute$/,
    handle: async (ctx) => {
      const [connectionId, datatype, remoteId] = ctx.params;
      const kind = datatypeOf(datatype);
      if (!connectionId || !kind || !remoteId)
        return ctx.redirect('/admin/items', '!No such item.');
      const key: Key = { connection_id: connectionId, datatype: kind, remote_id: remoteId };
      return resultPage(
        ctx,
        `Recomputed ${kind} ${remoteId}`,
        await recomputeMany([keyOf(key)]),
        itemHref(key),
      );
    },
  },
];
