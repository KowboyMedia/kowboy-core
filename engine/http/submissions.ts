// `POST /v1/submissions`, `GET /v1/submissions/slots` and `GET /v1/submissions/bot-check`
// (docs/forms.md, approved with question 130; the bot check's key with 155): a site's form reaches
// the brokerage's CRM through Core, and the CRM's answer reaches the visitor while they wait. The
// site's own server calls these with its token; the visitor's browser never does. Core
// authenticates, checks the bot check's proof, validates, finds the connection and hands the
// submission to that connection's adapter inside the request; it stores and logs the id and the
// outcome, keeps the form itself encrypted until the CRM has taken it, or 30 days when it never
// does (question 160 a), never writes the person anywhere in plain text, and reads nothing out of
// the submission to decide anything.
import { authenticate } from './changes.js';
import { validateSlots, validateSubmission } from '../contract.js';
import { connectionById, subscriberByBellUrl } from '../storage/connections.js';
import { readItem } from '../storage/items.js';
import {
  claimSubmission,
  officesOfTenant,
  settleSubmission,
  submissionById,
  type SubmissionRow,
} from '../storage/submissions.js';
import { logEvent } from '../events.js';
import { report } from '../errors.js';
import { humanCheck, verifyHuman } from '../human.js';
import { manifestFor, submissionsFor } from '../registry.js';
import { jsonResponse, type Request, type Response } from './server.js';
import type {
  Adapter,
  Connection,
  Slots,
  Submission,
  SubmissionResult,
} from '../adapter-api/types.js';

/** More than this from one tenant in a minute is answered 429 (strategy §13). */
export const SUBMISSIONS_PER_MINUTE = 60;
/** How long Core waits for the CRM before the submission counts as failed (strategy §13). */
export const SUBMISSION_TIMEOUT_MS = 20_000;
const MINUTE_MS = 60_000;
/** How often a repeated id still in flight looks for the first request's answer. */
const WAIT_STEP_MS = 50;

/** Who came in: the tenant, and the site when it is known. */
type Door = { tenantId: number; subscriberId: number | null };

/**
 * Whether this Core hands forms to the CRM. Only the live service does (question 152): staging
 * reads a real brokerage's office, so a form tried there must never reach it. Everywhere else a
 * form goes all the way to the CRM call and stops there, refused with this reason.
 */
let live = false;
export const NOT_LIVE =
  'Det här är en testsida, så formuläret skickades inte vidare till mäklaren.';

export function configureSubmissions(settings: { live: boolean }): void {
  live = settings.live;
}

const recent = new Map<number, number[]>();

/** The limit per tenant, in this process: a sliding minute. */
function overLimit(tenantId: number): boolean {
  const now = Date.now();
  const times = (recent.get(tenantId) ?? []).filter((at) => now - at < MINUTE_MS);
  const over = times.length >= SUBMISSIONS_PER_MINUTE;
  if (!over) times.push(now);
  recent.set(tenantId, times);
  return over;
}

/** Test helper: a fresh engine has taken nothing. */
export function resetSubmissionLimits(): void {
  recent.clear();
}

/** A form: the tenant token, the bot check's proof, and the site named by `X-Core-Site`. */
export async function submit(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('error' in auth) return jsonResponse(auth.status, { error: auth.error });
  const notHuman = await checkHuman(request);
  if (notHuman) return notHuman;
  const subscriberId = await subscriberByBellUrl(
    auth.tenantId,
    request.headers['x-core-site'] ?? null,
  );
  return submitThrough(request, { tenantId: auth.tenantId, subscriberId });
}

/**
 * The proof the window earned from the bot check, which the site's server passes on in
 * `X-Core-Human`, before anything else is read. The live service takes no form while the check is
 * not set up (known bug 4); elsewhere no check means none, since the guard keeps every form there
 * from the CRM anyway.
 */
async function checkHuman(request: Request): Promise<Response | null> {
  if (!humanCheck()) {
    if (!live) return null;
    report(new Error('a form was refused: the bot check is not set up'), { where: 'submission' });
    return jsonResponse(503, { error: 'the bot check is not set up' });
  }
  const passed = await verifyHuman(request.headers['x-core-human'] ?? null);
  return passed ? null : jsonResponse(403, { error: 'the bot check did not pass' });
}

/**
 * `GET /v1/submissions/bot-check`: the bot check's public key, which the site's window renders
 * the challenge with, or null while there is no check.
 */
export async function botCheck(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('error' in auth) return jsonResponse(auth.status, { error: auth.error });
  return jsonResponse(200, { human: humanCheck() });
}

async function submitThrough(request: Request, door: Door): Promise<Response> {
  if (overLimit(door.tenantId)) {
    return jsonResponse(429, {
      error: `more than ${String(SUBMISSIONS_PER_MINUTE)} submissions in a minute; try again shortly`,
    });
  }
  const parsed = parseSubmission(request);
  if ('response' in parsed) return parsed.response;
  const { submission } = parsed;

  const routed = await route(door.tenantId, submission);
  if ('response' in routed) return routed.response;
  const { connection, send } = routed;

  const where = {
    tenantId: door.tenantId,
    connectionId: connection.id,
    datatype: submission.record?.datatype ?? null,
    remoteId: submission.record?.remote_id ?? null,
  };

  const claim = await claimSubmission({
    id: submission.id,
    ...where,
    kind: submission.kind,
    officeId: submission.office_id ?? null,
    submission,
  });
  if (!claim.claimed) {
    // The same id again: a double click or a retried request. The first request's answer is the
    // answer, once it is in; nothing is sent twice.
    if (claim.existing.tenant_id !== door.tenantId) {
      return jsonResponse(400, { id: submission.id, error: 'this id was used by another tenant' });
    }
    return answerFrom(await settled(claim.existing));
  }

  const subscriberId = door.subscriberId;
  await logEvent({
    type: 'submission.received',
    correlationId: submission.id,
    ...where,
    subscriberId,
    fields: { kind: submission.kind, client: request.headers['x-core-client'] ?? null },
  });
  const result = await deliver(send, connection, submission);
  await settleSubmission(submission.id, result);
  await logEvent({
    type: `submission.${result.outcome}`,
    correlationId: submission.id,
    ...where,
    subscriberId,
    fields: { kind: submission.kind, ...said(result) },
  });
  return answerFrom(toAnswer(submission.id, result));
}

type Parsed = { submission: Submission } | { response: Response };

/** The JSON and the schema: the answers given before any lookup. */
function parseSubmission(request: Request): Parsed {
  let body: unknown;
  try {
    body = request.json<unknown>();
  } catch {
    return { response: jsonResponse(400, { error: 'the body is not JSON' }) };
  }
  const checked = validateSubmission(body);
  if (!checked.valid) {
    return { response: jsonResponse(400, { error: 'not a submission', detail: checked.errors }) };
  }
  return { submission: body as Submission };
}

type Routed =
  { connection: Connection; send: NonNullable<Adapter['submit']> } | { response: Response };

/** The connection the submission goes through, and the adapter that takes this kind. */
async function route(tenantId: number, submission: Submission): Promise<Routed> {
  const found = await findConnection(tenantId, submission);
  if ('error' in found) {
    return { response: jsonResponse(400, { id: submission.id, error: found.error }) };
  }
  if (found.officeId && !submission.office_id) submission.office_id = found.officeId;

  const { connection } = found;
  const manifest = manifestFor(connection.provider);
  const handlers = submissionsFor(connection.provider);
  if (!manifest?.submissions?.includes(submission.kind) || !handlers?.submit) {
    return {
      response: jsonResponse(501, {
        id: submission.id,
        error: `this tenant's CRM takes no ${submission.kind.replace('_', ' ')}`,
      }),
    };
  }
  return { connection, send: handlers.submit };
}

type Found = { connection: Connection; officeId?: string } | { error: string };

/**
 * Which connection the submission goes through: the record's for an interest or a viewing; for a
 * lead, the office's, or the tenant's only office. A lookup, never a judgement.
 */
async function findConnection(tenantId: number, submission: Submission): Promise<Found> {
  if (submission.record) {
    const connection = await connectionById(submission.record.connection_id);
    if (!connection || connection.tenantId !== tenantId) {
      return { error: 'the record is not one of this tenant’s' };
    }
    const item = await readItem({
      tenantId,
      connectionId: connection.id,
      datatype: submission.record.datatype,
      remoteId: submission.record.remote_id,
    });
    if (!item || item.deleted) return { error: 'no such record' };
    const found = usable(connection);
    return 'error' in found || !item.office_id ? found : { ...found, officeId: item.office_id };
  }
  return submission.office_id
    ? connectionForOffice(tenantId, submission.office_id)
    : connectionForOnlyOffice(tenantId);
}

/** A lead to a named office: the connection that licenses it, or holds its record. */
async function connectionForOffice(tenantId: number, officeId: string): Promise<Found> {
  const offices = await officesOfTenant(tenantId);
  const match = offices.find((office) => office.officeId === officeId);
  const connection = match ? await connectionById(match.connectionId) : null;
  if (!connection) return { error: 'the office is not one of this tenant’s' };
  return usable(connection);
}

/** A lead with no office named: fine for a tenant with one office, which is filled in. */
async function connectionForOnlyOffice(tenantId: number): Promise<Found> {
  const offices = await officesOfTenant(tenantId);
  const distinct = new Set(offices.map((office) => office.officeId));
  if (distinct.size > 1) return { error: 'office_id is required: this tenant has several offices' };
  const only = offices[0];
  const connection = only ? await connectionById(only.connectionId) : null;
  if (!only || !connection) return { error: 'this tenant has no office to receive it' };
  const found = usable(connection);
  return 'error' in found ? found : { ...found, officeId: only.officeId };
}

const usable = (connection: Connection): Found =>
  connection.active ? { connection } : { error: 'the connection is paused' };

/**
 * Ask the adapter, and count no answer in time, or an error, as a failure. Never throws. Outside
 * the live service the adapter is never asked.
 */
async function deliver(
  send: NonNullable<Adapter['submit']>,
  connection: Connection,
  submission: Submission,
): Promise<SubmissionResult> {
  if (!live) return { outcome: 'refused', reason: NOT_LIVE };
  try {
    return await withinTime(send(connection, submission), SUBMISSION_TIMEOUT_MS);
  } catch (error) {
    report(error, {
      where: 'submission',
      provider: connection.provider,
      connectionId: connection.id,
      kind: submission.kind,
    });
    return { outcome: 'failed', detail: error instanceof Error ? error.message : String(error) };
  }
}

function withinTime<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`the CRM did not answer within ${String(ms / 1000)} s`)),
      ms,
    );
    timer.unref?.();
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** What the event log says of the CRM's answer: the reference, the reason or the cause. */
const said = (result: SubmissionResult): Record<string, unknown> =>
  result.outcome === 'delivered'
    ? { reference: result.reference ?? null }
    : result.outcome === 'refused'
      ? { reason: result.reason }
      : { detail: result.detail };

/** Wait for the first request with this id to get its answer, up to the CRM timeout. */
async function settled(row: SubmissionRow): Promise<SubmissionRow> {
  const deadline = Date.now() + SUBMISSION_TIMEOUT_MS;
  let current: SubmissionRow | null = row;
  while (current && current.outcome === 'received' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
    current = await submissionById(row.id);
  }
  return current ?? row;
}

/** An outcome as the table holds it: `detail` is the refusal's reason or the failure's cause. */
type Answer = { id: string; outcome: string; reference?: string | null; detail?: string | null };

const toAnswer = (id: string, result: SubmissionResult): Answer => ({
  id,
  outcome: result.outcome,
  reference: result.outcome === 'delivered' ? (result.reference ?? null) : null,
  detail:
    result.outcome === 'refused'
      ? result.reason
      : result.outcome === 'failed'
        ? result.detail
        : null,
});

/** The six answers of docs/forms.md, the four after the CRM answered. */
function answerFrom(answer: Answer): Response {
  switch (answer.outcome) {
    case 'delivered':
      return jsonResponse(200, {
        id: answer.id,
        status: 'delivered',
        reference: answer.reference ?? null,
      });
    case 'refused':
      return jsonResponse(409, { id: answer.id, status: 'refused', reason: answer.detail ?? '' });
    default:
      // Failed, or still unanswered after the timeout: the visitor tries again.
      return jsonResponse(502, { id: answer.id, status: 'failed' });
  }
}

/**
 * `GET /v1/submissions/slots?connection_id=…&remote_id=…`: the home's viewings and slots as the
 * CRM sees them now, one live read per booking attempt (docs/forms.md, "Reading the slots").
 */
export async function slots(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('error' in auth) return jsonResponse(auth.status, { error: auth.error });
  return slotsThrough(request, { tenantId: auth.tenantId, subscriberId: null });
}

async function slotsThrough(request: Request, door: Door): Promise<Response> {
  const connectionId = request.query.get('connection_id');
  const remoteId = request.query.get('remote_id');
  if (!connectionId || !remoteId) {
    return jsonResponse(400, { error: 'connection_id and remote_id are required' });
  }
  const connection = await connectionById(connectionId);
  if (!connection || connection.tenantId !== door.tenantId) {
    return jsonResponse(400, { error: 'the record is not one of this tenant’s' });
  }
  const item = await readItem({
    tenantId: door.tenantId,
    connectionId,
    datatype: 'property',
    remoteId,
  });
  if (!item || item.deleted) return jsonResponse(400, { error: 'no such record' });

  const handlers = submissionsFor(connection.provider);
  if (!handlers?.slots) return jsonResponse(501, { error: "this tenant's CRM gives no slots" });

  let answer: Slots;
  try {
    answer = await withinTime(
      handlers.slots(connection, { datatype: 'property', remoteId, officeId: item.office_id }),
      SUBMISSION_TIMEOUT_MS,
    );
  } catch (error) {
    report(error, { where: 'slots', provider: connection.provider, connectionId, remoteId });
    return jsonResponse(502, { error: 'the CRM did not answer' });
  }
  const checked = validateSlots(answer);
  if (!checked.valid) {
    report(
      new Error(`the slots do not match schemas/slots.v1.json: ${checked.errors.join('; ')}`),
      { where: 'slots', provider: connection.provider, connectionId },
    );
    return jsonResponse(502, { error: 'the CRM’s answer could not be read' });
  }
  return jsonResponse(200, answer);
}
