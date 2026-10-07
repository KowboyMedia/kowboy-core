// Failed forms (question 160 a): the forms visitors sent that did not reach the CRM, as Core keeps
// them for 30 days, with what the visitor wrote and why, and "Send again". The list reads the kept
// forms; sending again is the forms' own send (engine/http/submissions.ts), said here in the admin
// area's words.
import {
  contentOf,
  keptSubmissions,
  submissionById,
  type SubmissionRow,
} from '../storage/submissions.js';
import { connections, subscribers, tenantById } from '../storage/connections.js';
import { readItem } from '../storage/items.js';
import { db } from '../storage/db.js';
import { NOT_LIVE } from '../registry.js';
import { UNANSWERED_MS, sendAgain, type SentAgain } from '../http/submissions.js';
import type { Datatype, Submission } from '../adapter-api/types.js';
import { audit } from './audit.js';
import type { Session } from './auth.js';
import { toRow } from './records.js';
import { connectionNamed, crmName } from './words.js';

/**
 * Refused by the CRM, held back by Core outside production (the CRM never saw it), not sent
 * because of an error, or cut off before the CRM answered.
 */
export type FailedOutcome = 'refused' | 'held' | 'failed' | 'unanswered';

export type FailedForm = {
  id: string;
  tenantId: number;
  tenant: string;
  connectionId: string;
  /** The connection by the name a person gave it. */
  connectionName: string;
  /** The CRM the connection logs in to. */
  provider: string;
  /** The site the visitor sent it from, by its name; the name is null for a site since removed. */
  site: { id: number; name: string | null } | null;
  kind: string;
  datatype: string | null;
  remoteId: string | null;
  /** The home's address or name, while Core holds it. */
  home: string | null;
  officeId: string | null;
  outcome: FailedOutcome;
  /** The CRM's reason or the failure's cause, as the CRM or Core said it. */
  said: string | null;
  receivedAt: string;
  answeredAt: string | null;
  /** The form as the site sent it. */
  form: Submission;
};

/** Core's own hold outside production is not the CRM's refusal. */
const outcomeOf = (outcome: string, detail: string | null): FailedOutcome => {
  if (outcome === 'received') return 'unanswered';
  if (outcome === 'refused' && detail === NOT_LIVE) return 'held';
  return outcome as FailedOutcome;
};

/** The site each form came from, as its first event says. */
async function sitesOf(ids: string[]): Promise<Map<string, { id: number; name: string | null }>> {
  if (ids.length === 0) return new Map();
  const [{ rows }, sites] = await Promise.all([
    db().query<{ correlation_id: string; subscriber_id: string }>(
      `select correlation_id, subscriber_id from events
       where type = 'submission.received' and correlation_id = any($1) and subscriber_id is not null`,
      [ids],
    ),
    subscribers(),
  ]);
  const names = new Map(sites.map((site) => [Number(site.id), site.label]));
  return new Map(
    rows.map((row) => {
      const id = Number(row.subscriber_id);
      return [row.correlation_id, { id, name: names.get(id) ?? null }];
    }),
  );
}

/** The home a form is about, by its address or name, while Core holds it. */
async function homeOf(row: {
  tenant_id: number;
  connection_id: string;
  datatype: string | null;
  remote_id: string | null;
}): Promise<string | null> {
  if (!row.datatype || !row.remote_id) return null;
  const item = await readItem({
    tenantId: row.tenant_id,
    connectionId: row.connection_id,
    datatype: row.datatype as Datatype,
    remoteId: row.remote_id,
  });
  if (!item) return null;
  const shown = toRow(item, undefined);
  return shown.addressLine ?? shown.name;
}

/** Every form Core keeps that the CRM did not take, newest first. */
export async function failedForms(): Promise<FailedForm[]> {
  const rows = await keptSubmissions(UNANSWERED_MS);
  const sites = await sitesOf(rows.map((row) => row.id));
  const names = new Map((await connections()).map((row) => [row.id, row.name]));
  const forms: FailedForm[] = [];
  for (const row of rows) {
    const form = contentOf(row);
    if (!form) continue;
    forms.push({
      id: row.id,
      tenantId: row.tenant_id,
      tenant: row.tenant,
      connectionId: row.connection_id,
      connectionName: names.get(row.connection_id) ?? row.connection_id,
      provider: row.provider ?? '',
      site: sites.get(row.id) ?? null,
      kind: row.kind,
      datatype: row.datatype,
      remoteId: row.remote_id,
      home: await homeOf(row),
      officeId: row.office_id,
      outcome: outcomeOf(row.outcome, row.detail),
      said: row.detail,
      receivedAt: row.received_at.toISOString(),
      answeredAt: row.outcome === 'received' ? null : (row.answered_at?.toISOString() ?? null),
      form,
    });
  }
  return forms;
}

const KINDS: Record<string, string> = {
  lead: 'valuation or contact requests',
  interest: 'interests in a home',
  viewing: 'viewing bookings',
  search_profile: 'search profiles',
};

/** What a sentence about a form that was not sent names. */
type Named = { tenant: string; crm: string; connection: string; kind: string };

/** Why "Send again" did not send, in words naming the tenant, the connection and the CRM. */
const REFUSALS: Record<Extract<SentAgain, { error: string }>['why'], (named: Named) => string> = {
  'no-form': () =>
    'Not sent: Core no longer keeps this form. Either the CRM has taken the form since, or 30 days have passed since the visitor sent it.',
  'on-its-way': () =>
    'Not sent: this form is being sent right now, perhaps by someone else. Reload the page in a minute to see how that send ended.',
  foreign: ({ tenant }) =>
    `Not sent: ${tenant} no longer has the CRM connection that this form’s home came through.`,
  gone: () =>
    'Not sent: the home is no longer on the CRM’s list, and Core sends no form about a removed home.',
  office: ({ tenant }) =>
    `Not sent: the office this form is for is no longer one of ${tenant}’s offices.`,
  'which-office': ({ tenant }) =>
    `Not sent: the form names no office, and ${tenant} has several, so Core cannot tell which office should get the form.`,
  'no-office': ({ tenant }) => `Not sent: ${tenant} has no office in Core to receive the form.`,
  kind: ({ crm, kind }) => `Not sent: ${crm} does not take ${kind} from Core.`,
};

async function refusal(id: string, why: keyof typeof REFUSALS): Promise<string> {
  // An id that names no form is never looked up: it may not even be one Core could have made.
  const row = why === 'no-form' ? null : await submissionById(id);
  return REFUSALS[why](await namesOf(row));
}

/** What a refusal names about a form: its tenant, its CRM and connection, and its kind. */
async function namesOf(row: SubmissionRow | null): Promise<Named> {
  const tenant = (row && (await tenantById(row.tenant_id))?.display_name) ?? 'the tenant';
  const connection = row
    ? (await connections()).find((one) => one.id === row.connection_id)
    : undefined;
  return {
    tenant,
    crm: connection ? crmName(connection.provider) : 'the CRM',
    connection: connection
      ? connectionNamed(connection.name, tenant, connection.provider)
      : 'the CRM connection',
    kind: KINDS[row?.kind ?? ''] ?? 'this kind of form',
  };
}

/**
 * "Send again" as the admin area says it: Core's own hold outside production is "held", and a
 * form that cannot go says why in words.
 */
export async function sendAgainAsked(
  id: string,
): Promise<
  | { answer: { outcome: string; reference?: string | null; detail?: string | null } }
  | { status: number; error: string }
> {
  const sent = await sendAgain(id);
  if ('error' in sent) return { status: sent.status, error: await refusal(id, sent.why) };
  const { answer } = sent;
  return answer.outcome === 'refused' && answer.detail === NOT_LIVE
    ? { answer: { ...answer, outcome: 'held' } }
    : { answer };
}

/** Who sent a form again and what the CRM said, on the form's chain and its record's timeline. */
export async function auditSentAgain(session: Session, id: string, outcome: string): Promise<void> {
  const row = await submissionById(id);
  await audit(
    session,
    'form_sent_again',
    { kind: row?.kind ?? null, outcome },
    {
      tenantId: row?.tenant_id ?? null,
      connectionId: row?.connection_id ?? null,
      datatype: row?.datatype ?? null,
      remoteId: row?.remote_id ?? null,
      correlationId: id,
    },
  );
}
