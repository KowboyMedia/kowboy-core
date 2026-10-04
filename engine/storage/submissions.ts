// The outcomes of form submissions (docs/forms.md): what Core keeps of a form a site posted. The
// id, the kind, the record and what the CRM said, never the person.
import { db } from './db.js';
import type { SubmissionKind, SubmissionResult } from '../adapter-api/types.js';

export type SubmissionOutcome = 'received' | 'delivered' | 'refused' | 'failed';

export type SubmissionRow = {
  id: string;
  tenant_id: number;
  connection_id: string;
  kind: SubmissionKind;
  datatype: string | null;
  remote_id: string | null;
  office_id: string | null;
  outcome: SubmissionOutcome;
  reference: string | null;
  detail: string | null;
  received_at: Date;
  answered_at: Date | null;
};

/** A repeated id inside this window answers the stored outcome; after it, the form is sent again. */
export const REPEAT_WINDOW_MS = 24 * 60 * 60_000;

export type ClaimInput = {
  id: string;
  tenantId: number;
  connectionId: string;
  kind: SubmissionKind;
  datatype: string | null;
  remoteId: string | null;
  officeId: string | null;
};

/**
 * Take the id for this request. The first request with an id claims it and sends; a second one
 * with the same id gets the stored row instead, so a double click or a retried request makes one
 * lead. An id older than the window is claimed again, as a new form.
 */
export async function claimSubmission(
  input: ClaimInput,
): Promise<{ claimed: true } | { claimed: false; existing: SubmissionRow }> {
  const { rows } = await db().query<SubmissionRow>(
    `insert into submissions (id, tenant_id, connection_id, kind, datatype, remote_id, office_id, outcome)
     values ($1, $2, $3, $4, $5, $6, $7, 'received')
     on conflict (id) do update
       set tenant_id = excluded.tenant_id, connection_id = excluded.connection_id,
           kind = excluded.kind, datatype = excluded.datatype, remote_id = excluded.remote_id,
           office_id = excluded.office_id, outcome = 'received', reference = null, detail = null,
           received_at = now(), answered_at = null
       where submissions.received_at < now() - ($8 || ' milliseconds')::interval
     returning *`,
    [
      input.id,
      input.tenantId,
      input.connectionId,
      input.kind,
      input.datatype,
      input.remoteId,
      input.officeId,
      REPEAT_WINDOW_MS,
    ],
  );
  if (rows[0]) return { claimed: true };
  const existing = await submissionById(input.id);
  if (!existing) throw new Error(`submission ${input.id} vanished between the claim and the read`);
  return { claimed: false, existing };
}

/** Record what the CRM said. */
export async function settleSubmission(id: string, result: SubmissionResult): Promise<void> {
  const reference = result.outcome === 'delivered' ? (result.reference ?? null) : null;
  const detail =
    result.outcome === 'refused'
      ? result.reason
      : result.outcome === 'failed'
        ? result.detail
        : null;
  await db().query(
    `update submissions set outcome = $2, reference = $3, detail = $4, answered_at = now() where id = $1`,
    [id, result.outcome, reference, detail],
  );
}

export async function submissionById(id: string): Promise<SubmissionRow | null> {
  const { rows } = await db().query<SubmissionRow>('select * from submissions where id = $1', [id]);
  return rows[0] ?? null;
}

export type SubmissionCounts = { delivered: number; refused: number; failed: number };

/** How many forms this connection's CRM took, refused and left unanswered since a moment. */
export async function submissionCounts(
  connectionId: string,
  sinceMs: number,
): Promise<SubmissionCounts> {
  const { rows } = await db().query<{ outcome: SubmissionOutcome; count: string }>(
    `select outcome, count(*) as count from submissions
     where connection_id = $1 and received_at >= now() - ($2 || ' milliseconds')::interval
     group by outcome`,
    [connectionId, sinceMs],
  );
  const counts: SubmissionCounts = { delivered: 0, refused: 0, failed: 0 };
  for (const row of rows) {
    if (row.outcome in counts) counts[row.outcome as keyof SubmissionCounts] = Number(row.count);
  }
  return counts;
}

/** The connections whose latest answered submission failed: the CRM did not answer (health). */
export async function connectionsWithFailingSubmissions(): Promise<string[]> {
  const { rows } = await db().query<{ connection_id: string }>(
    `select connection_id from (
       select distinct on (connection_id) connection_id, outcome from submissions
       where outcome <> 'received'
       order by connection_id, answered_at desc
     ) latest
     where outcome = 'failed'
     order by connection_id`,
  );
  return rows.map((row) => row.connection_id);
}

/** Outcomes older than the retention go, with the events that told of them. Housekeeping. */
export async function deleteExpiredSubmissions(days: number): Promise<number> {
  const { rowCount } = await db().query(
    `delete from submissions where received_at < now() - ($1 || ' days')::interval`,
    [days],
  );
  return rowCount ?? 0;
}

/**
 * Every office of a tenant with the connection it comes through: the offices a connection is
 * licensed for, or, for a connection licensed for every office, the office records it holds.
 * What a lead with an `office_id` is matched against, and what tells whether a tenant has one
 * office (docs/forms.md, "Find the connection").
 */
export async function officesOfTenant(
  tenantId: number,
): Promise<{ connectionId: string; officeId: string }[]> {
  const { rows } = await db().query<{ connection_id: string; office_id: string }>(
    `select c.id as connection_id, o.office_id
     from connections c
     join lateral (
       select unnest(c.licensed_offices) as office_id
       union
       select i.remote_id from items i
       where i.connection_id = c.id and i.datatype = 'office' and i.deleted = false
         and cardinality(c.licensed_offices) = 0
     ) o on true
     where c.tenant_id = $1
     order by c.id, o.office_id`,
    [tenantId],
  );
  return rows.map((row) => ({ connectionId: row.connection_id, officeId: row.office_id }));
}
