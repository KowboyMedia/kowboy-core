import { changesPage } from '../storage/items.js';
import { recordPull, tenantForToken } from '../storage/connections.js';
import { logEvent } from '../events.js';
import { gzipPage, itemHead, pagePart } from '../pages.js';
import { DATATYPES, type Datatype } from '../adapter-api/types.js';
import { gzipLevel, jsonResponse, type Request, type Response } from './server.js';

/** Default and maximum page size (strategy AC 27). */
export const PAGE_SIZE = 100;

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

  const client = request.headers['x-core-client'] ?? null;
  const site = request.headers['x-core-site'] ?? null;
  const subscriberId = await recordPull(tenantId, client, site);
  // A pull that brought nothing is told by the site's last pull alone: sites ask every datatype
  // every 15 minutes, and a line for each would be most of the event log.
  if (rows.length > 0) {
    await logEvent({
      type: 'pull',
      tenantId,
      subscriberId,
      datatype,
      fields: { after, items: rows.length, client, site, duration_ms: Date.now() - startedAt },
    });
  }

  // The page from the records' parts as they are stored, compressed already; a record that has
  // no part yet gets one made now.
  const last = rows[rows.length - 1];
  const nextAfter = last ? Number(last.seq) : after;
  return {
    status: 200,
    gzipped: gzipPage(
      [
        '{"items":[',
        ...rows.flatMap((row, index) => [
          (index === 0 ? '' : ',') + itemHead(Number(row.seq), row.remote_updated_at),
          row.page_part ?? pagePart(row),
        ]),
        `],"next_after":${String(nextAfter)},"has_more":${String(rows.length === limit)}}`,
      ],
      gzipLevel(),
    ),
  };
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
