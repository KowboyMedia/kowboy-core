import { sameSecret } from '../storage/crypto.js';
import { sendLifecycle } from '../lifecycle.js';
import { recompute, type Scope } from '../recompute.js';
import { queryEvents, type EventQuery } from '../events.js';
import { ring, type BellKind } from '../bells.js';
import { jsonResponse, type Request, type Response } from './server.js';
import type { Datatype, LifecycleEvent } from '../adapter-api/types.js';

/** `/v1/admin/*` (SRS §10). Header `X-Admin-Secret` must equal `ADMIN_SECRET`. */
export function adminRoutes(
  adminSecret: string,
): { method: string; path: string; handler: (request: Request) => Promise<Response> }[] {
  const guard =
    (handler: (request: Request) => Promise<Response>) =>
    async (request: Request): Promise<Response> => {
      const provided = request.headers['x-admin-secret'] ?? '';
      if (!sameSecret(provided, adminSecret)) return jsonResponse(401, { error: 'unauthorized' });
      return handler(request);
    };

  return [
    {
      method: 'POST',
      path: '/v1/admin/bell',
      handler: guard(async (request) => {
        const body = request.json<{ tenant_id?: string; kind?: BellKind }>();
        if (!body.tenant_id) return jsonResponse(400, { error: 'tenant_id is required' });
        await ring(body.tenant_id, body.kind ?? 'delta');
        return jsonResponse(202, { ok: true });
      }),
    },
    {
      method: 'POST',
      path: '/v1/admin/event',
      handler: guard(async (request) => {
        const body = request.json<{
          connection_id?: string;
          event?: LifecycleEvent['type'];
          office_ids?: string[];
          datatype?: Datatype;
        }>();
        if (!body.connection_id || !body.event) {
          return jsonResponse(400, { error: 'connection_id and event are required' });
        }
        await sendLifecycle(body.connection_id, body.event, {
          officeIds: body.office_ids,
          datatype: body.datatype,
        });
        return jsonResponse(202, { ok: true });
      }),
    },
    {
      // Replay and recompute are the same operation: mappers and rules re-run over stored raw,
      // with no CRM traffic (SRS §4.7, §7).
      method: 'POST',
      path: '/v1/admin/replay',
      handler: guard(async (request) => {
        const body = request.json<{ connection_id?: string; datatype?: Datatype }>();
        if (!body.connection_id) return jsonResponse(400, { error: 'connection_id is required' });
        const scope: Scope = { connectionId: body.connection_id, datatype: body.datatype };
        return jsonResponse(200, await recompute(scope));
      }),
    },
    {
      method: 'POST',
      path: '/v1/admin/recompute',
      handler: guard(async (request) => {
        const body = request.json<{
          tenant_id?: string;
          connection_id?: string;
          datatype?: Datatype;
          dry_run?: boolean;
        }>();
        const scope: Scope = {
          tenantId: body.tenant_id,
          connectionId: body.connection_id,
          datatype: body.datatype,
        };
        return jsonResponse(200, await recompute(scope, { dryRun: body.dry_run === true }));
      }),
    },
    {
      method: 'GET',
      path: '/v1/admin/events',
      handler: guard(async (request) => {
        return jsonResponse(200, { events: await queryEvents(eventQuery(request.query)) });
      }),
    },
  ];
}

/** `?entity=<connection>/<datatype>/<remote id>` plus the plain filters (SRS §11). */
function eventQuery(query: URLSearchParams): EventQuery {
  const [connectionId, datatype, remoteId] = (query.get('entity') ?? '').split('/');
  const value = (name: string): string | undefined => query.get(name) ?? undefined;
  return {
    entity: connectionId && datatype && remoteId ? { connectionId, datatype, remoteId } : undefined,
    connectionId: value('connection'),
    tenantId: value('tenant'),
    correlationId: value('correlation'),
    type: value('type'),
    from: value('from'),
    to: value('to'),
    limit: query.has('limit') ? Number(query.get('limit')) : undefined,
  };
}
