// A tenant's CRM connection is made and changed on the tenant's page (tenants.ts). Here is what an
// operator does with it once it exists: the loads and actions handed to the worker, what the
// adapter knows about it, and its latest events. The old connection pages send to the tenant.
import {
  connections,
  setConnectionActive,
  type ConnectionListRow,
} from '../storage/connections.js';
import { queueLifecycle } from '../lifecycle.js';
import { queryEvents } from '../events.js';
import { DATATYPES, type Datatype, type LifecycleEvent } from '../adapter-api/types.js';
import { connectionStatus } from './adapters.js';
import { card, form, grid, select } from './html.js';
import { eventsTable } from './timeline.js';
import type { Ctx, Panel } from './context.js';

const EVENTS: LifecycleEvent['type'][] = ['connection_added', 'resync', 'connection_removed'];

const tenantHref = (row: ConnectionListRow): string => `/admin/tenants/${row.tenant_id}`;

const rowOf = async (id: string): Promise<ConnectionListRow | undefined> =>
  (await connections()).find((row) => row.id === id);

/** The loads and actions for one connection, each handed to the worker. */
export function actionCards(ctx: Ctx, row: ConnectionListRow): string {
  const action = (
    event: LifecycleEvent['type'],
    inner: string,
    submit: string,
    danger = false,
  ): string =>
    form(`/admin/connections/${encodeURIComponent(row.id)}/event`, ctx.csrf, inner, {
      submit,
      hidden: { event },
      danger,
    });
  return grid([
    card(
      'Load everything',
      'Fetches every record of the licensed offices again, and whatever they refer to. Saving the tenant already loads new offices; use this when in doubt.',
      action('connection_added', '', 'Load everything'),
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
}

/** What the adapter knows about the connection, when it has something to say. */
export async function statusCard(ctx: Ctx, row: ConnectionListRow): Promise<string> {
  const status = await connectionStatus(ctx.adapters, row.provider, row.id);
  return status
    ? card(
        'What the adapter knows',
        'Schedules and the fetch list for this connection, as its adapter reports them.',
        status,
      )
    : '';
}

export async function eventsCard(row: ConnectionListRow): Promise<string> {
  const events = await queryEvents({ connectionId: row.id, limit: 20, newestFirst: true });
  return card('Latest events', 'The 20 newest events of this connection.', eventsTable(events));
}

export const connectionPanels: Panel[] = [
  {
    // The connection used to have a page of its own; everything is on the tenant's page now.
    method: 'GET',
    pattern: /^\/admin\/connections\/([^/]+)$/,
    handle: async (ctx) => {
      const row = await rowOf(ctx.params[0] ?? '');
      return row
        ? ctx.redirect(tenantHref(row))
        : { ...ctx.render('Not found', '<p>No such connection.</p>'), status: 404 };
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/connections\/([^/]+)\/event$/,
    handle: async (ctx) => {
      const row = await rowOf(ctx.params[0] ?? '');
      if (!row) return ctx.redirect('/admin/tenants', '!No such connection.');
      const event = EVENTS.find((candidate) => candidate === ctx.form['event']);
      if (!event) return ctx.redirect(tenantHref(row), '!Unknown action.');
      const datatype = DATATYPES.find((candidate) => candidate === ctx.form['datatype']) as
        Datatype | undefined;
      await queueLifecycle(row.id, event, { datatype });
      if (event === 'connection_removed') await setConnectionActive(row.id, false);
      return ctx.redirect(
        tenantHref(row),
        `Queued ${event}; the worker delivers it within seconds.`,
      );
    },
  },
];
