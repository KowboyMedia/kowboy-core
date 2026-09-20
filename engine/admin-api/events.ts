// The event log (strategy §8.2): the timeline query, paged and filtered, for the panel and the
// agents alike. A filter value that is not what it should be is left out and named, so the page
// stays up.
import { queryEvents, type EventQuery } from '../events.js';
import { json, momentOf, numberOf, stringOf, type Route } from './context.js';

const MAX = 1000;

/** The filters of a query string, and what was ignored. */
export function eventQuery(query: URLSearchParams): { filter: EventQuery; problems: string[] } {
  const problems: string[] = [];
  const value = (name: string): string | undefined => stringOf(query.get(name));
  const moment = (name: string): string | undefined => {
    const raw = value(name);
    if (raw === undefined) return undefined;
    const iso = momentOf(raw);
    if (iso === undefined) problems.push(`${name}: "${raw}" is not a date, ignored`);
    return iso;
  };
  const number = (name: string): number | undefined => {
    const raw = value(name);
    if (raw === undefined) return undefined;
    const n = numberOf(raw);
    if (n === undefined)
      problems.push(`${name}: "${raw}" is not a whole number above zero, ignored`);
    return n;
  };
  const [connectionId, datatype, remoteId] = (value('entity') ?? '').split('/');
  const before = number('before');
  const filter: EventQuery = {
    entity: connectionId && datatype && remoteId ? { connectionId, datatype, remoteId } : undefined,
    connectionId: value('connection'),
    tenantId: number('tenant'),
    subscriberId: number('subscriber'),
    correlationId: value('correlation'),
    type: value('type'),
    from: moment('from'),
    to: moment('to'),
    beforeId: before,
    afterId: number('after'),
    limit: Math.min(number('limit') ?? 100, MAX),
    newestFirst: value('order') === 'desc' || before !== undefined,
  };
  return { filter, problems };
}

export const eventRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/events$/,
    handle: async (ctx) => {
      const { filter, problems } = eventQuery(ctx.request.query);
      const events = await queryEvents(filter);
      const full = events.length === filter.limit;
      const last = events[events.length - 1];
      return json({
        events,
        problems,
        /** Where the next page starts: older than this event when newest first, newer otherwise. */
        next: full && last ? Number(last.id) : null,
      });
    },
  },
];
