// The Events page (question 168 a, built from zero on 2026-10-07): Core's whole log, newest first,
// a page at a time, or one happening's steps together, oldest first, when a record's page or a
// form links to them. Every step is a sentence, never a type or a payload: the record it is about
// by its address or name, opening its page, then what happened, with the connection, site and
// tenant its sentence names each leading to its place on the tenant's page.
import type { EventRow } from '../events.js';
import { db } from '../storage/db.js';
import { namesInTurn } from './feed.js';
import { namedFor, summarise, type Names } from './summary.js';
import { recordsLinked, type Linked } from './things.js';

/** Steps on one page of the log. */
export const STEPS_PAGE = 100;

/** A name in a step's sentence and its place in the admin area. */
type Place = { text: string; to: string };

export type Step = {
  id: number;
  at: string;
  /** The record the step is about, by its address or name, opening its page. */
  about: Linked | null;
  /** What happened, in a sentence. */
  said: string;
  /** The names the sentence holds, each with its place, the connection before its tenant. */
  places: Place[];
};

/** The tenant a step belongs to: its own, its connection's or its site's. */
function tenantOf(row: EventRow, names: Names): number | null {
  if (row.tenant_id !== null) return Number(row.tenant_id);
  const connection = names.connections.get(row.connection_id ?? '');
  if (connection) return connection.tenantId;
  return names.sites.get(Number(row.subscriber_id ?? Number.NaN))?.tenantId ?? null;
}

/** Where the names in a step's sentence lead: a connection or site to its block, a tenant to its page. */
function placesOf(row: EventRow, names: Names): Place[] {
  const tenantId = tenantOf(row, names);
  if (tenantId === null) return [];
  const page = `/tenants/${String(tenantId)}`;
  const named = namedFor(row, names);
  const connection = row.connection_id !== null && names.connections.has(row.connection_id);
  return [
    ...(connection && named.connection
      ? [{ text: named.connection, to: `${page}#connection:${row.connection_id ?? ''}` }]
      : []),
    ...(named.site ? [{ text: named.site, to: `${page}#site:${String(row.subscriber_id)}` }] : []),
    ...(named.tenant ? [{ text: named.tenant, to: page }] : []),
  ];
}

const recordOf = (row: EventRow) =>
  row.connection_id !== null && row.datatype !== null && row.remote_id !== null
    ? { connection: row.connection_id, datatype: row.datatype, id: row.remote_id }
    : null;

/** One page of steps: the whole log newest first, or one happening's steps oldest first. */
export async function steps(
  page: number,
  chain: string | null,
): Promise<{ steps: Step[]; total: number }> {
  const where = chain === null ? '' : 'where correlation_id = $1';
  const values = chain === null ? [] : [chain];
  const offset = (Math.max(Math.trunc(page), 1) - 1) * STEPS_PAGE;
  const { rows } = await db().query<EventRow>(
    `select * from events ${where} order by id ${chain === null ? 'desc' : 'asc'}
     limit ${String(STEPS_PAGE)} offset ${String(offset)}`,
    values,
  );
  const counted = await db().query<{ total: string }>(
    `select count(*) as total from events ${where}`,
    values,
  );
  const names = await namesInTurn();
  const records = rows.map(recordOf);
  const linked = await recordsLinked(
    records.filter((record) => record !== null),
    names,
  );
  let next = 0;
  return {
    total: Number(counted.rows[0]?.total ?? 0),
    steps: rows.map((row, index) => {
      const said = summarise(row.type, row.fields, namedFor(row, names));
      return {
        id: Number(row.id),
        at: row.at.toISOString(),
        about: records[index] ? (linked[next++] ?? null) : null,
        said,
        places: placesOf(row, names).filter((place) => said.includes(place.text)),
      };
    }),
  };
}
