import { contentHash } from './json.js';
import { validateData, SCHEMA_VERSION } from './contract.js';
import { applyRules, RULES_VERSION } from './rules/run.js';
import { mapperFor } from './registry.js';
import { logEvent } from './events.js';
import { ring } from './bells.js';
import { takeWriteLock, transaction } from './storage/db.js';
import { itemsForScope, writeItem, type ItemRow } from './storage/items.js';
import { connectionById } from './storage/connections.js';
import { changedFields } from './ingest.js';
import type { Canonical, Datatype } from './adapter-api/types.js';

export type Scope = {
  tenantId?: string;
  connectionId?: string;
  datatype?: Datatype;
  /** One item, from the admin panel. */
  remoteId?: string;
  /** Only rows produced by an older rules version (SRS §3). */
  staleRulesOnly?: boolean;
};

export type ImpactReport = {
  examined: number;
  changed: number;
  unchanged: number;
  failed: number;
  failures: { remoteId: string; datatype: Datatype; errors: string[] }[];
  examples: {
    remoteId: string;
    datatype: Datatype;
    changed: Record<string, { from: unknown; to: unknown }>;
  }[];
};

/**
 * Re-run mappers, rules and `display` over stored `raw`, with no CRM traffic (SRS §4.7, §7).
 * Replay and recompute are the same operation: raw is always stored, so one code path serves both.
 * `dryRun` is the release impact preview (AC 36) and writes nothing.
 */
export async function recompute(
  scope: Scope,
  options: { dryRun?: boolean; exampleLimit?: number } = {},
): Promise<ImpactReport> {
  const exampleLimit = options.exampleLimit ?? 10;
  const report: ImpactReport = {
    examined: 0,
    changed: 0,
    unchanged: 0,
    failed: 0,
    failures: [],
    examples: [],
  };

  const items = await itemsForScope({
    tenantId: scope.tenantId,
    connectionId: scope.connectionId,
    datatype: scope.datatype,
    remoteId: scope.remoteId,
    rulesVersionBefore: scope.staleRulesOnly ? RULES_VERSION : undefined,
  });
  const touchedTenants = new Set<string>();

  for (const item of items) {
    report.examined += 1;
    const outcome = await redo(item);

    if (outcome.status === 'failed') {
      report.failed += 1;
      report.failures.push({
        remoteId: item.remote_id,
        datatype: item.datatype,
        errors: outcome.errors,
      });
      continue;
    }
    if (outcome.status === 'unchanged') {
      report.unchanged += 1;
      continue;
    }

    report.changed += 1;
    if (report.examples.length < exampleLimit) {
      report.examples.push({
        remoteId: item.remote_id,
        datatype: item.datatype,
        changed: changedFields(item.data, outcome.data),
      });
    }
    if (options.dryRun) continue;

    const seq = await store(item, outcome);
    touchedTenants.add(item.tenant_id);
    await logEvent({
      type: 'entity.written',
      tenantId: item.tenant_id,
      connectionId: item.connection_id,
      datatype: item.datatype,
      remoteId: item.remote_id,
      fields: {
        seq,
        cause: 'recompute',
        old_hash: item.content_hash,
        new_hash: outcome.hash,
        changed: changedFields(item.data, outcome.data),
        rules_version: RULES_VERSION,
      },
    });
  }

  for (const tenantId of touchedTenants) await ring(tenantId);
  return report;
}

type Redone =
  | { status: 'failed'; errors: string[] }
  | { status: 'unchanged' }
  | {
      status: 'changed';
      data: Canonical;
      hash: string;
      officeId: string | null;
      remoteUpdatedAt: string | null;
    };

/** One stored row, put back through the current mappers and rules. */
async function redo(item: ItemRow): Promise<Redone> {
  const connection = await connectionById(item.connection_id);
  const mapper = connection && mapperFor(connection.provider, item.datatype);
  if (!mapper) return { status: 'failed', errors: ['no adapter registered for this connection'] };

  let mapped;
  try {
    mapped = mapper(item.raw);
  } catch (error) {
    return { status: 'failed', errors: [String(error)] };
  }

  const data = applyRules(item.datatype, mapped.data);
  const validation = validateData(item.datatype, data);
  if (!validation.valid) return { status: 'failed', errors: validation.errors };

  const hash = contentHash(data);
  if (hash === item.content_hash && item.rules_version === RULES_VERSION) {
    return { status: 'unchanged' };
  }
  return {
    status: 'changed',
    data,
    hash,
    officeId: mapped.officeId,
    remoteUpdatedAt: mapped.remoteUpdatedAt,
  };
}

const store = (item: ItemRow, outcome: Extract<Redone, { status: 'changed' }>): Promise<number> =>
  transaction(async (client) => {
    await takeWriteLock(client);
    return writeItem(client, {
      tenantId: item.tenant_id,
      connectionId: item.connection_id,
      datatype: item.datatype,
      remoteId: item.remote_id,
      officeId: outcome.officeId,
      contentHash: outcome.hash,
      raw: item.raw,
      data: outcome.data,
      remoteUpdatedAt: outcome.remoteUpdatedAt ?? item.remote_updated_at?.toISOString() ?? null,
      rulesVersion: RULES_VERSION,
      schemaVersion: SCHEMA_VERSION,
      deleted: false,
    });
  });
