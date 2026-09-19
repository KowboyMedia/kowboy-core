import { changesPage, type ItemRow } from '../storage/items.js';
import { recordPull, tenantForToken } from '../storage/connections.js';
import { logEvent } from '../events.js';
import { DATATYPES, type Datatype } from '../adapter-api/types.js';
import { jsonResponse, type Request, type Response } from './server.js';

/** Default and maximum page size (strategy AC 27). */
export const PAGE_SIZE = 100;

/** The item envelope as a subscriber receives it (schemas/item.v1.json). */
export const toEnvelope = (row: ItemRow): Record<string, unknown> => ({
  datatype: row.datatype,
  connection_id: row.connection_id,
  remote_id: row.remote_id,
  office_id: row.office_id,
  seq: Number(row.seq),
  deleted: row.deleted,
  schema_version: row.schema_version,
  content_hash: row.content_hash,
  remote_updated_at: row.remote_updated_at?.toISOString() ?? null,
  raw: row.deleted ? null : row.raw,
  data: row.data,
});

/**
 * `GET /v1/changes` (SRS §8): everything for this tenant and datatype after `seq`, tombstones
 * included. Each item carries `raw`, the CRM payload untouched, next to `data` (Patric,
 * 2026-09-18). The tenant comes from the token; a `tenant_id` parameter is rejected.
 */
export async function changes(request: Request): Promise<Response> {
  const parsed = await parseRequest(request);
  if ('error' in parsed) return jsonResponse(parsed.status, { error: parsed.error });

  const { tenantId, datatype, after, limit } = parsed;
  const startedAt = Date.now();
  const rows = await changesPage({ tenantId, datatype, after, limit });
  const items = rows.map(toEnvelope);

  const client = request.headers['x-core-client'] ?? null;
  await recordPull(tenantId, client);
  await logEvent({
    type: 'pull',
    tenantId,
    datatype,
    fields: { after, items: items.length, client, duration_ms: Date.now() - startedAt },
  });

  return jsonResponse(200, {
    items,
    next_after: items.length > 0 ? items[items.length - 1]?.seq : after,
    has_more: items.length === limit,
  });
}

type Failure = { error: string; status: number };

type ParsedRequest =
  { tenantId: number; datatype: Datatype; after: number; limit: number } | Failure;

const failed = (parsed: object): parsed is Failure => 'error' in parsed;

async function parseRequest(request: Request): Promise<ParsedRequest> {
  const authenticated = await authenticate(request);
  if (failed(authenticated)) return authenticated;

  const params = parseParams(request.query);
  if (failed(params)) return params;

  // A cursor below the purge watermark may have missed a delete: pull everything, then sweep
  // locally only after a complete pull (strategy §7). A fresh subscriber (after = 0) is fine.
  if (params.after > 0 && params.after < authenticated.purgeWatermark) {
    return { error: 'resync_required', status: 409 };
  }
  return { tenantId: authenticated.tenantId, ...params };
}

/** The tenant comes from the token, never from a parameter (SRS §8). */
export async function authenticate(
  request: Request,
): Promise<{ tenantId: number; purgeWatermark: number } | Failure> {
  const token = (request.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'a tenant token is required', status: 401 };

  const tenant = await tenantForToken(token);
  if (!tenant) return { error: 'unknown token', status: 401 };

  if (request.query.has('tenant_id')) {
    return { error: 'tenant_id is not accepted; the token names the tenant', status: 400 };
  }
  return { tenantId: tenant.id, purgeWatermark: tenant.purgeWatermark };
}

function parseParams(
  query: URLSearchParams,
): { datatype: Datatype; after: number; limit: number } | Failure {
  const datatype = query.get('datatype');
  if (!datatype || !DATATYPES.includes(datatype as Datatype)) {
    return { error: `datatype must be one of ${DATATYPES.join(', ')}`, status: 400 };
  }

  const after = Number(query.get('after') ?? 0);
  if (!Number.isInteger(after) || after < 0) return { error: 'after must be a seq', status: 400 };

  const requested = Number(query.get('limit') ?? PAGE_SIZE);
  const limit = Math.min(
    Number.isFinite(requested) && requested > 0 ? requested : PAGE_SIZE,
    PAGE_SIZE,
  );
  return { datatype: datatype as Datatype, after, limit };
}
