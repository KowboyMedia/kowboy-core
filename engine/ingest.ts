import { contentHash } from './json.js';
import { validateData, SCHEMA_VERSION } from './contract.js';
import { applyRules, RULES_VERSION } from './rules/run.js';
import { mapperFor } from './registry.js';
import { logEvent } from './events.js';
import { ring } from './bells.js';
import { db, takeWriteLock, transaction } from './storage/db.js';
import { readItem, writeItem, liveRemoteIds } from './storage/items.js';
import type { Canonical, Connection, Datatype, IngestResult } from './adapter-api/types.js';

/**
 * The write path, identical for every adapter (strategy §5.2):
 * map → rules and display → licensed-office filter → hash → unchanged? stop → write, log, bell.
 */
export async function ingest(
  connection: Connection,
  datatype: Datatype,
  remoteId: string,
  raw: unknown,
  options: { correlationId?: string } = {},
): Promise<IngestResult> {
  const context = {
    correlationId: options.correlationId ?? null,
    tenantId: connection.tenantId,
    connectionId: connection.id,
    datatype,
    remoteId,
  };

  const prepared = await prepare(connection, datatype, raw, context);
  if ('reason' in prepared) return { outcome: 'dropped', reason: prepared.reason };

  const { data, officeId, remoteUpdatedAt } = prepared;
  const hash = contentHash(data);
  const key = { tenantId: connection.tenantId, connectionId: connection.id, datatype, remoteId };
  const existing = await readItem(key);

  if (unchanged(existing, hash)) {
    // Same content: no seq, no bell, nothing reaches a site. Keep raw current for replay.
    await db().query(
      `update items set raw = $5, remote_updated_at = $6, updated_at = now()
       where tenant_id = $1 and connection_id = $2 and datatype = $3 and remote_id = $4`,
      [
        key.tenantId,
        key.connectionId,
        key.datatype,
        key.remoteId,
        JSON.stringify(raw),
        remoteUpdatedAt,
      ],
    );
    await logEvent({ ...context, type: 'entity.unchanged', fields: { content_hash: hash } });
    return { outcome: 'unchanged' };
  }

  const seq = await transaction(async (client) => {
    await takeWriteLock(client);
    return writeItem(client, {
      ...key,
      officeId,
      contentHash: hash,
      raw,
      data,
      remoteUpdatedAt,
      rulesVersion: RULES_VERSION,
      schemaVersion: SCHEMA_VERSION,
      deleted: false,
    });
  });

  await logEvent({
    ...context,
    type: 'entity.written',
    fields: {
      seq,
      old_hash: existing?.content_hash ?? null,
      new_hash: hash,
      changed: changedFields(existing?.data ?? null, data),
      rules_version: RULES_VERSION,
    },
  });
  await ring(connection.tenantId);
  return { outcome: 'written', seq };
}

type Context = {
  correlationId: string | null;
  tenantId: string;
  connectionId: string;
  datatype: Datatype;
  remoteId: string;
};

type Prepared =
  | { data: Canonical; officeId: string | null; remoteUpdatedAt: string | null }
  | { reason: 'unlicensed' | 'malformed' | 'unknown-datatype' | 'inactive' };

/** Map, apply rules, filter by licence and check the contract. Every refusal is logged here. */
async function prepare(
  connection: Connection,
  datatype: Datatype,
  raw: unknown,
  context: Context,
): Promise<Prepared> {
  const drop = async (reason: Extract<Prepared, { reason: string }>['reason'], fields = {}) => {
    await logEvent({ ...context, type: 'entity.dropped', fields: { reason, ...fields } });
    return { reason };
  };

  if (!connection.active) return drop('inactive');

  const mapper = mapperFor(connection.provider, datatype);
  if (!mapper) return drop('unknown-datatype');

  let mapped;
  try {
    mapped = mapper(raw);
  } catch (error) {
    // One malformed record never stops the others (AC 11).
    return drop('malformed', { detail: String(error) });
  }

  if (!isLicensed(connection, mapped.officeId)) {
    return drop('unlicensed', { office_id: mapped.officeId });
  }

  const data = applyRules(datatype, mapped.data);
  const validation = validateData(datatype, data);
  if (!validation.valid) return drop('malformed', { errors: validation.errors });

  return { data, officeId: mapped.officeId, remoteUpdatedAt: mapped.remoteUpdatedAt };
}

/** A stored row that already holds this content, produced by the rules running today. */
const unchanged = (existing: Awaited<ReturnType<typeof readItem>>, hash: string): boolean =>
  existing !== null &&
  !existing.deleted &&
  existing.content_hash === hash &&
  existing.rules_version === RULES_VERSION;

/** The CRM confirmed the record is gone: tombstone it (SRS §7). */
export async function notFound(
  connection: Connection,
  datatype: Datatype,
  remoteId: string,
  options: { correlationId?: string } = {},
): Promise<void> {
  const key = {
    tenantId: connection.tenantId,
    connectionId: connection.id,
    datatype,
    remoteId,
  };
  const existing = await readItem(key);
  if (!existing || existing.deleted) return;

  const seq = await transaction(async (client) => {
    await takeWriteLock(client);
    return writeItem(client, {
      ...key,
      officeId: existing.office_id,
      contentHash: contentHash({ tombstone: remoteId }),
      raw: existing.raw,
      data: null,
      remoteUpdatedAt: existing.remote_updated_at?.toISOString() ?? null,
      rulesVersion: RULES_VERSION,
      schemaVersion: SCHEMA_VERSION,
      deleted: true,
    });
  });

  await logEvent({
    type: 'entity.tombstoned',
    correlationId: options.correlationId ?? null,
    tenantId: connection.tenantId,
    connectionId: connection.id,
    datatype,
    remoteId,
    fields: { seq },
  });
  await ring(connection.tenantId);
}

/** "These are all the ids that exist in this scope." Everything else is tombstoned (strategy §5.1). */
export async function presentIds(
  connection: Connection,
  datatype: Datatype,
  scope: { officeId: string | null },
  ids: string[],
): Promise<{ tombstoned: string[] }> {
  const present = new Set(ids);
  const stored = await liveRemoteIds(connection.id, datatype, scope.officeId);
  const missing = stored.filter((remoteId) => !present.has(remoteId));
  for (const remoteId of missing) await notFound(connection, datatype, remoteId);
  return { tombstoned: missing };
}

/** Empty `licensed_offices` means every office the credential can see (SRS §3). */
function isLicensed(connection: Connection, officeId: string | null): boolean {
  if (connection.licensedOffices.length === 0) return true;
  if (officeId === null) return true; // tenant-wide record
  return connection.licensedOffices.includes(officeId);
}

/** Top-level and display fields that changed, with before and after (strategy §8.2). */
export function changedFields(
  before: Canonical | null,
  after: Canonical,
): Record<string, { from: unknown; to: unknown }> {
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  const flatten = (data: Canonical | null): Record<string, unknown> => {
    if (!data) return {};
    const flat: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'display' && value && typeof value === 'object') {
        for (const [displayKey, displayValue] of Object.entries(value as Canonical)) {
          flat[`display.${displayKey}`] = displayValue;
        }
      } else if (key !== 'provider_extras') {
        flat[key] = value;
      }
    }
    return flat;
  };

  const from = flatten(before);
  const to = flatten(after);
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    if (JSON.stringify(from[key]) !== JSON.stringify(to[key])) {
      changed[key] = { from: from[key] ?? null, to: to[key] ?? null };
    }
  }
  return changed;
}
