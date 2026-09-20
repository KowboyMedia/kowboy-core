// Long operations as jobs: queue a recompute of a scope, as a preview or for real, watch it, stop
// it, and read what it did. The worker runs them (engine/jobs.ts).
import { cancelJob, createJob, getJob, listJobs, type JobRow } from '../jobs.js';
import type { Scope } from '../recompute.js';
import { datatypeOf, HttpError, json, numberOf, stringOf, type Route } from './context.js';

/** The named records of a selection, each with its connection, datatype and id. */
function keysOf(given: unknown): Scope['keys'] {
  if (!Array.isArray(given)) return undefined;
  const keys = given.map((item: Record<string, unknown>) => ({
    tenantId: 0,
    connectionId: stringOf(item['connectionId']),
    datatype: datatypeOf(item['datatype']),
    remoteId: stringOf(item['remoteId']),
  }));
  if (keys.length === 0) throw new HttpError(400, 'the selection is empty');
  for (const key of keys) {
    if (!key.connectionId || !key.datatype || !key.remoteId) {
      throw new HttpError(400, 'every key needs a connectionId, a datatype and a remoteId');
    }
  }
  return keys as NonNullable<Scope['keys']>;
}

/** A scope as the panel sends it: any mix of a CRM, a tenant, a connection, an office, a datatype, one record, or named records. */
export function scopeOf(input: unknown): Scope {
  const given = (input ?? {}) as Record<string, unknown>;
  const scope: Scope = {
    provider: stringOf(given['provider']),
    tenantId: numberOf(given['tenantId']),
    connectionId: stringOf(given['connectionId']),
    officeId: stringOf(given['officeId']),
    datatype: datatypeOf(given['datatype']),
    remoteId: stringOf(given['remoteId']),
    staleRulesOnly: given['staleRulesOnly'] === true ? true : undefined,
    keys: keysOf(given['keys']),
  };
  for (const key of Object.keys(scope) as (keyof Scope)[])
    if (scope[key] === undefined) delete scope[key];
  return scope;
}

export const jobView = (job: JobRow): Record<string, unknown> => ({
  ...job,
  id: Number(job.id),
});

export const jobRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/jobs$/,
    handle: async (ctx) =>
      json({ jobs: (await listJobs(numberOf(ctx.request.query.get('limit')) ?? 50)).map(jobView) }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/jobs$/,
    handle: async (ctx) => {
      const body = ctx.body<{ kind?: string; scope?: unknown; dryRun?: boolean }>();
      if (body.kind !== undefined && body.kind !== 'recompute') {
        throw new HttpError(400, 'the only kind of job is recompute');
      }
      const scope = scopeOf(body.scope);
      const dryRun = body.dryRun === true;
      const id = await createJob({ kind: 'recompute', scope, dryRun, requestedBy: ctx.actor });
      await ctx.audit(
        dryRun ? 'recompute.preview' : 'recompute.run',
        { job: id, scope },
        { tenantId: scope.tenantId ?? null, connectionId: scope.connectionId ?? null },
      );
      return json({ id }, 201);
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/admin\/jobs\/(\d+)$/,
    handle: async (ctx) => {
      const job = await getJob(Number(ctx.params[0]));
      if (!job) throw new HttpError(404, 'no such job');
      return json({ job: jobView(job) });
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/admin\/jobs\/(\d+)\/cancel$/,
    handle: async (ctx) => {
      const id = Number(ctx.params[0]);
      const stopped = await cancelJob(id);
      if (!stopped) throw new HttpError(409, 'the job has already finished');
      await ctx.audit('job.cancel', { job: id });
      return json({ ok: true });
    },
  },
];
