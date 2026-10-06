// The outcomes of form submissions (docs/forms.md): what Core keeps of a form a site posted. The
// id, the kind, the record and what the CRM said; and, until the CRM has taken the form, the form
// itself, encrypted with the key of the CRM logins (question 160 a). A form the CRM refused or
// never answered keeps it for 30 days, so it can be read and sent again.
import { db } from './db.js';
import { decrypt, encrypt } from './crypto.js';
import type { Submission, SubmissionKind, SubmissionResult } from '../adapter-api/types.js';

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
  /** When the CRM last answered; while a person's "Send again" is on its way, when it began. */
  answered_at: Date | null;
  /** The form as the site sent it, encrypted; null once the CRM took it, or after 30 days. */
  content: string | null;
};

/** How long a form the CRM did not take keeps its details (question 160 a). */
export const KEPT_DAYS = 30;

let contentKey = '';

/** The key the details are encrypted with: the CRM logins' (CREDENTIALS_KEY). */
export function configureSubmissionContent(key: string): void {
  contentKey = key;
}

/** A kept form's details, as the site sent them; null when none are kept. */
export const contentOf = (row: SubmissionRow): Submission | null =>
  row.content ? (JSON.parse(decrypt(row.content, contentKey)) as Submission) : null;

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
  /** The form itself, kept encrypted until the CRM has it. */
  submission: Submission;
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
    `insert into submissions (id, tenant_id, connection_id, kind, datatype, remote_id, office_id, outcome, content)
     values ($1, $2, $3, $4, $5, $6, $7, 'received', $9)
     on conflict (id) do update
       set tenant_id = excluded.tenant_id, connection_id = excluded.connection_id,
           kind = excluded.kind, datatype = excluded.datatype, remote_id = excluded.remote_id,
           office_id = excluded.office_id, outcome = 'received', reference = null, detail = null,
           received_at = now(), answered_at = null, content = excluded.content
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
      encrypt(JSON.stringify(input.submission), contentKey),
    ],
  );
  if (rows[0]) return { claimed: true };
  const existing = await submissionById(input.id);
  if (!existing) throw new Error(`submission ${input.id} vanished between the claim and the read`);
  return { claimed: false, existing };
}

/** Record what the CRM said. A form the CRM took drops its details; any other keeps them. */
export async function settleSubmission(id: string, result: SubmissionResult): Promise<void> {
  const reference = result.outcome === 'delivered' ? (result.reference ?? null) : null;
  const detail =
    result.outcome === 'refused'
      ? result.reason
      : result.outcome === 'failed'
        ? result.detail
        : null;
  await db().query(
    `update submissions set outcome = $2, reference = $3, detail = $4, answered_at = now(),
       content = case when $2 = 'delivered' then null else content end
     where id = $1`,
    [id, result.outcome, reference, detail],
  );
}

/**
 * The forms Core keeps that the CRM did not take, newest first: refused, not answered, or cut off
 * before the CRM answered (still waiting `unansweredMs` after the send began). What the admin
 * area lists as failed forms (question 160 a).
 */
export async function keptSubmissions(
  unansweredMs: number,
): Promise<(SubmissionRow & { tenant: string })[]> {
  const { rows } = await db().query<SubmissionRow & { tenant: string }>(
    `select s.*, t.display_name as tenant
     from submissions s join tenants t on t.id = s.tenant_id
     where s.content is not null
       and (s.outcome in ('refused', 'failed')
            or (s.outcome = 'received'
                and coalesce(s.answered_at, s.received_at) < now() - ($1 || ' milliseconds')::interval))
     order by s.received_at desc`,
    [unansweredMs],
  );
  return rows;
}

/**
 * Take a kept form for one more send (question 160 a): only one the CRM refused or did not
 * answer, and only one send at a time, so two presses of "Send again" send once. Null when the
 * form is on its way, was taken, or keeps no details.
 */
export async function claimAgain(id: string, unansweredMs: number): Promise<SubmissionRow | null> {
  const { rows } = await db().query<SubmissionRow>(
    `update submissions
     set outcome = 'received', reference = null, detail = null, answered_at = now()
     where id = $1 and content is not null
       and (outcome in ('refused', 'failed')
            or (outcome = 'received'
                and coalesce(answered_at, received_at) < now() - ($2 || ' milliseconds')::interval))
     returning *`,
    [id, unansweredMs],
  );
  return rows[0] ?? null;
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

/**
 * Outcomes older than the retention go, with the events that told of them, and a kept form's
 * details go after 30 days whatever the retention. Housekeeping.
 */
export async function deleteExpiredSubmissions(days: number): Promise<number> {
  await db().query(
    `update submissions set content = null
     where content is not null and received_at < now() - ($1 || ' days')::interval`,
    [KEPT_DAYS],
  );
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
