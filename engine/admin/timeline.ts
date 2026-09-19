// The event log as a page (strategy §8.2): filters, newest first, and a table shared with the
// overview and the item page.
import { connections, tenants } from '../storage/connections.js';
import { queryEvents, type EventRow } from '../events.js';
import { card, escape, field, intro, link, pre, select, table, when } from './html.js';
import type { Panel } from './context.js';

const enc = encodeURIComponent;

export function eventsTable(events: EventRow[]): string {
  return table(
    ['When', 'Type', 'Tenant', 'Connection', 'Record', 'Correlation', 'Details'],
    events.map((event) => [
      when(event.at),
      `<code>${escape(event.type)}</code>`,
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
      const [tenantRows, connectionRows] = await Promise.all([tenants(), connections()]);
      const any = { value: '', label: 'any' };
      const filters =
        `<form method="get" action="/admin/events">` +
        select(
          'tenant',
          'Tenant',
          [any, ...tenantRows.map((row) => ({ value: row.id }))],
          current('tenant'),
        ) +
        select(
          'connection',
          'Connection',
          [any, ...connectionRows.map((row) => ({ value: row.id }))],
          current('connection'),
        ) +
        field('type', 'Event type', {
          value: current('type'),
          help: 'Such as entity.written, bell.sent, webhook.received or admin.login.',
        }) +
        field('correlation', 'Correlation id', {
          value: current('correlation'),
          help: 'Every event a single notification or fetch caused shares one correlation id.',
        }) +
        field('entity', 'One record', {
          value: current('entity'),
          placeholder: 'connection/datatype/record id',
          help: 'Connection, datatype and record id, separated by slashes.',
        }) +
        field('from', 'From', { value: current('from'), placeholder: '2026-09-18T00:00:00Z' }) +
        field('to', 'To', { value: current('to'), placeholder: '2026-09-19T00:00:00Z' }) +
        field('limit', 'At most', { type: 'number', value: query.get('limit') ?? '200' }) +
        `<button class="btn btn-primary">Filter</button></form>`;
      const body =
        intro(
          'Everything Core and its adapters did, newest first: notifications, fetches, writes, bells, pulls and logins. Events are kept for 30 days.',
        ) +
        card('Filter', 'Any field narrows the list; leave the rest empty.', filters) +
        card(
          'Events',
          'Open "fields" on a row for everything the event recorded.',
          eventsTable(events),
        );
      return ctx.render('Events', body);
    },
  },
];
