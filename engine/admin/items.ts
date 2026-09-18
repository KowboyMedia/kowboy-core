// One item, three faces: raw, unified and display, with its timeline and a recompute.
import { findItems, type ItemRow } from '../storage/items.js';
import { queryEvents } from '../events.js';
import { recompute } from '../recompute.js';
import { DATATYPES, type Datatype } from '../adapter-api/types.js';
import { escape, field, form, link, pre, select, table, when } from './html.js';
import { eventsTable } from './timeline.js';
import type { Ctx, Panel } from './context.js';

const enc = encodeURIComponent;
const itemHref = (row: { connection_id: string; datatype: string; remote_id: string }): string =>
  `/admin/items/${enc(row.connection_id)}/${enc(row.datatype)}/${enc(row.remote_id)}`;

const datatypeOf = (value: string | undefined): Datatype | undefined =>
  DATATYPES.find((candidate) => candidate === value);

function resultsTable(rows: ItemRow[]): string {
  return table(
    ['Datatype', 'Connection', 'Remote id', 'Office', 'Seq', 'Deleted', 'Updated'],
    rows.map((row) => [
      escape(row.datatype),
      escape(row.connection_id),
      link(itemHref(row), row.remote_id),
      escape(row.office_id ?? ''),
      escape(row.seq),
      escape(row.deleted ? 'yes' : 'no'),
      when(row.updated_at),
    ]),
    'Nothing matches.',
  );
}

function itemPage(ctx: Ctx, row: ItemRow, events: Awaited<ReturnType<typeof queryEvents>>): string {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const { display, ...unified } = data;
  const envelope = table(
    ['Field', 'Value'],
    [
      ['Tenant', escape(row.tenant_id)],
      ['Connection', escape(row.connection_id)],
      ['Office', escape(row.office_id ?? '')],
      ['Seq', escape(row.seq)],
      ['Deleted', escape(row.deleted ? 'yes' : 'no')],
      ['Content hash', `<code>${escape(row.content_hash)}</code>`],
      ['Remote updated', when(row.remote_updated_at)],
      ['Written', when(row.updated_at)],
      ['Rules version', escape(row.rules_version)],
    ],
  );
  const faces = `<div class="columns"><div><h2>Raw</h2>${pre(row.raw)}</div><div><h2>Unified</h2>${pre(unified)}</div><div><h2>Display</h2>${pre(display ?? {})}</div></div>`;
  const actions = form(`${itemHref(row)}/recompute`, ctx.csrf, '', {
    submit: 'Recompute this item (no CRM traffic)',
  });
  return envelope + faces + actions + '<h2>Timeline</h2>' + eventsTable(events);
}

export const itemPanels: Panel[] = [
  {
    method: 'GET',
    pattern: /^\/admin\/items$/,
    handle: async (ctx) => {
      const query = ctx.request.query;
      const value = (name: string): string | undefined => query.get(name) || undefined;
      const searched = ['datatype', 'id', 'office', 'connection'].some((name) => query.get(name));
      const rows = searched
        ? await findItems({
            datatype: datatypeOf(value('datatype')),
            remoteId: value('id'),
            officeId: value('office'),
            connectionId: value('connection'),
          })
        : [];
      const search = `<form method="get" action="/admin/items"><div class="columns">${select('datatype', 'Datatype', [{ value: '', label: 'any' }, ...DATATYPES.map((d) => ({ value: d }))], query.get('datatype') ?? '')}${field('id', 'Remote id', { value: query.get('id') ?? '' })}${field('office', 'Office', { value: query.get('office') ?? '' })}${field('connection', 'Connection', { value: query.get('connection') ?? '' })}</div><button>Find</button></form>`;
      return ctx.render('Items', search + (searched ? resultsTable(rows) : ''));
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
      const report = await recompute({ connectionId, datatype: kind, remoteId });
      const back = itemHref({ connection_id: connectionId, datatype: kind, remote_id: remoteId });
      return ctx.render(
        `Recomputed ${kind} ${remoteId}`,
        pre(report) + `<p>${link(back, 'Back to the item')}</p>`,
      );
    },
  },
];
