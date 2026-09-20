// `POST /v1/errors` (question 46, Patric 2026-09-19): a site reports an error to Core instead of
// holding a Sentry key of its own. Core passes it through the same gate as its own errors, so one
// bug on fifty sites is one report a day, and answers whether this one left for Sentry.
import { authenticate } from './changes.js';
import { validateSiteError } from '../contract.js';
import { reportFromSite } from '../errors.js';
import { logEvent } from '../events.js';
import { jsonResponse, type Request, type Response } from './server.js';

type SiteError = { message: string; where: string; detail?: string };

export async function siteError(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if ('error' in auth) return jsonResponse(auth.status, { error: auth.error });

  let body: unknown;
  try {
    body = request.json<unknown>();
  } catch {
    return jsonResponse(400, { error: 'the body is not JSON' });
  }
  const checked = validateSiteError(body);
  if (!checked.valid)
    return jsonResponse(400, { error: 'not an error report', detail: checked.errors });

  const { message, where, detail } = body as SiteError;
  const client = request.headers['x-core-client'] ?? 'site';
  const reported = await reportFromSite({
    tenantId: auth.tenantId,
    client,
    message,
    where,
    ...(detail === undefined ? {} : { detail }),
  });
  // On the tenant's page too (the panel shows a site's own errors), not only in Sentry.
  await logEvent({
    type: 'site.error',
    tenantId: auth.tenantId,
    fields: { client, message, where, detail: detail ?? null, reported },
  });
  return jsonResponse(202, { recorded: true, reported });
}
