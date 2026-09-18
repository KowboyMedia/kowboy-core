// One item, three faces: raw, unified and display, with its timeline and a recompute.
import { findItems, type ItemRow } from '../storage/items.js';
import { queryEvents } from '../events.js';
import { recompute } from '../recompute.js';
import { DATATYPES, type Datatype } from '../adapter-api/types.js';
import {
  card,
  escape,
  field,
  form,
  grid,
  intro,
  kv,
  link,
  pre,
  select,
  table,
  when,
  yesNo,
} from './html.js';
import { eventsTable } from './timeline.js';
import type { Ctx, Panel } from './context.js';

const enc = encodeURIComponent;
const itemHref = (row: { connection_id: string; datatype: string; remote_id: string }): string =>
  `/admin/items/${enc(row.connection_id)}/${enc(row.datatype)}/${enc(row.remote_id)}`;

const datatypeOf = (value: string | undefined): Datatype | undefined =>
  DATATYPES.find((candidate) => candidate === value);

function resultsTable(rows: ItemRow[]): string {
  return table(
    ['Datatype', 'Connection', 'Record id', 'Office', 'Seq', 'Removed', 'Written'],
    rows.map((row) => [
      escape(row.datatype),
      escape(row.connection_id),
      link(itemHref(row), row.remote_id),
      escape(row.office_id ?? ''),
      escape(row.seq),
      yesNo(row.deleted),
      when(row.updated_at),
    ]),
    'Nothing matches.',
  );
}

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
    card('Raw', 'The record exactly as the CRM sent it.', pre(row.raw)),
    card('Unified', 'The same record in Core’s one shape, whatever the CRM.', pre(unified)),
    card('Display', 'The values the sites show, computed by the rules.', pre(display ?? {})),
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
      'Everything that happened to this record, newest first: notifications, fetches, writes, bells.',
      eventsTable(events),
    )
  );
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
      const search = `<form method="get" action="/admin/items">${select(
        'datatype',
        'Datatype',
        [{ value: '', label: 'any' }, ...DATATYPES.map((d) => ({ value: d }))],
        query.get('datatype') ?? '',
      )}${field('id', 'Record id', {
        value: query.get('id') ?? '',
        help: 'The id the CRM uses for the record.',
      })}${field('office', 'Office', {
        value: query.get('office') ?? '',
        help: 'An office id, to see one office’s records.',
      })}${field('connection', 'Connection', {
        value: query.get('connection') ?? '',
      })}<button>Find</button></form>`;
      const body =
        intro(
          'Find one record and see it as the CRM sent it, as Core unified it, and as the sites show it, with everything that happened to it.',
        ) +
        card('Find records', 'Any field narrows the search; leave the rest empty.', search) +
        (searched ? card('Results', 'The newest 100 at most.', resultsTable(rows)) : '');
      return ctx.render('Items', body);
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
        card(
          'Result',
          'How many records were examined and changed, and any failures.',
          pre(report) + `<p>${link(back, 'Back to the record')}</p>`,
        ),
      );
    },
  },
];
