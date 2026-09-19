// `POST /v1/applied` (question 37, Patric 2026-09-18): after each page a site pulled, it says
// which records it applied and which it could not, and Core puts that on each record's timeline,
// so the timeline runs from the CRM's notification to the site. The tenant comes from the token,
// as for a pull, and a record of another tenant's connection is nobody's to report on.
import { authenticate } from './changes.js';
import { validateApplied } from '../contract.js';
import { connectionById } from '../storage/connections.js';
import { logEvent } from '../events.js';
import { jsonResponse, type Request, type Response } from './server.js';
import type { Datatype } from '../adapter-api/types.js';

type Outcome = {
  datatype: Datatype;
  connection_id: string;
  remote_id: string;
  seq: number;
  result: 'applied' | 'failed';
  detail?: string;
};

export async function applied(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('error' in auth) return jsonResponse(auth.status, { error: auth.error });

  let body: unknown;
  try {
    body = request.json<unknown>();
  } catch {
    return jsonResponse(400, { error: 'the body is not JSON' });
  }
  const checked = validateApplied(body);
  if (!checked.valid) return jsonResponse(400, { error: 'not a report', detail: checked.errors });

  const client = request.headers['x-core-client'] ?? null;
  const owned = new Map<string, boolean>();
  let recorded = 0;
  for (const outcome of (body as { items: Outcome[] }).items) {
    if (!owned.has(outcome.connection_id)) {
      const connection = await connectionById(outcome.connection_id);
      owned.set(outcome.connection_id, connection?.tenantId === auth.tenantId);
    }
    if (!owned.get(outcome.connection_id)) continue;
    await logEvent({
      type: outcome.result === 'applied' ? 'site.applied' : 'site.failed',
      tenantId: auth.tenantId,
      connectionId: outcome.connection_id,
      datatype: outcome.datatype,
      remoteId: outcome.remote_id,
      fields: {
        seq: outcome.seq,
        client,
        ...(outcome.detail === undefined ? {} : { detail: outcome.detail }),
      },
    });
    recorded += 1;
  }
  return jsonResponse(202, { recorded });
}
