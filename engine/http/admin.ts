import { sameSecret } from '../storage/crypto.js';
import { queueLifecycle } from '../lifecycle.js';
import { recompute, type Scope } from '../recompute.js';
import { ring, type BellKind } from '../bells.js';
import { jsonResponse, type Request, type Response } from './server.js';
import type { Datatype, LifecycleEvent } from '../adapter-api/types.js';

/**
 * The operator API the agents and scripts call (SRS §10): header `X-Admin-Secret` must equal
 * `ADMIN_SECRET`. Everything else under `/v1/admin/` is the panel's API (engine/admin-api/),
 * which takes the same header or a login.
 */
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
        const body = request.json<{ tenant_id?: number; kind?: BellKind }>();
        const tenantId = Number(body.tenant_id);
        if (!Number.isInteger(tenantId) || tenantId <= 0)
          return jsonResponse(400, { error: 'tenant_id is required' });
        await ring(tenantId, body.kind ?? 'delta');
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
        const queued = await queueLifecycle(body.connection_id, body.event, {
          officeIds: body.office_ids,
          datatype: body.datatype,
        });
        if (queued === null)
          return jsonResponse(404, { error: `no connection ${body.connection_id}` });
        return jsonResponse(202, { ok: true, queued });
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
          tenant_id?: number;
          connection_id?: string;
          datatype?: Datatype;
          dry_run?: boolean;
        }>();
        const scope: Scope = {
          tenantId: body.tenant_id === undefined ? undefined : Number(body.tenant_id),
          connectionId: body.connection_id,
          datatype: body.datatype,
        };
        return jsonResponse(200, await recompute(scope, { dryRun: body.dry_run === true }));
      }),
    },
  ];
}
