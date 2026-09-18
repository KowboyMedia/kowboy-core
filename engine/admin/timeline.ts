// The event log as a page (strategy §8.2): filters, newest first, and a table shared with the
// overview and the item page.
import { queryEvents, type EventRow } from '../events.js';
import { escape, field, link, pre, table, when } from './html.js';
import type { Panel } from './context.js';

const enc = encodeURIComponent;

export function eventsTable(events: EventRow[]): string {
  return table(
    ['When', 'Type', 'Tenant', 'Connection', 'Entity', 'Correlation', 'Fields'],
    events.map((event) => [
      when(event.at),
      escape(event.type),
      escape(event.tenant_id ?? ''),
      escape(event.connection_id ?? ''),
      event.connection_id && event.datatype && event.remote_id
        ? link(
            `/admin/items/${enc(event.connection_id)}/${enc(event.datatype)}/${enc(event.remote_id)}`,
            `${event.datatype} ${event.remote_id}`,
          )
        : '',
      event.correlation_id
        ? link(
            `/admin/events?correlation=${enc(event.correlation_id)}`,
            event.correlation_id.slice(0, 8),
          )
        : '',
      `<details><summary>fields</summary>${pre(event.fields)}</details>`,
    ]),
    'No events.',
  );
}

export const eventPanels: Panel[] = [
  {
    method: 'GET',
    pattern: /^\/admin\/events$/,
    handle: async (ctx) => {
      const query = ctx.request.query;
      const value = (name: string): string | undefined => query.get(name) || undefined;
      const [connectionId, datatype, remoteId] = (query.get('entity') ?? '').split('/');
      const events = await queryEvents({
        tenantId: value('tenant'),
        connectionId: value('connection'),
        correlationId: value('correlation'),
        type: value('type'),
        from: value('from'),
        to: value('to'),
        entity:
          connectionId && datatype && remoteId ? { connectionId, datatype, remoteId } : undefined,
        limit: Number(query.get('limit') ?? 200),
        newestFirst: true,
      });
      const current = (name: string): string => query.get(name) ?? '';
      const filters = `<form method="get" action="/admin/events"><div class="columns">${field('tenant', 'Tenant', { value: current('tenant') })}${field('connection', 'Connection', { value: current('connection') })}${field('type', 'Event type', { value: current('type') })}${field('correlation', 'Correlation id', { value: current('correlation') })}${field('entity', 'Entity (connection/datatype/id)', { value: current('entity') })}${field('from', 'From (ISO time)', { value: current('from') })}${field('to', 'To (ISO time)', { value: current('to') })}${field('limit', 'At most', { type: 'number', value: query.get('limit') ?? '200' })}</div><button>Filter</button></form>`;
      return ctx.render('Events', filters + eventsTable(events));
    },
  },
];
