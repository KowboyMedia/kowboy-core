// A connection's login as a save or "Check the login" uses it: the fields typed now over the
// fields stored before, so typing one field never loses the others (known bug 3, fixed
// 2026-10-06). The login is one JSON document of fields, the adapter's to read; nothing here
// knows a CRM. A stored field the adapter no longer declares is dropped (Patric's rule for a
// removed feature, 2026-10-06: the data it kept goes too): at the next save, and at the worker's
// hourly housekeeping for a login nobody saves again.
import { adminFor } from '../registry.js';
import { connectionById, connections, upsertConnection } from '../storage/connections.js';

type Login = Record<string, unknown>;

/** The stored login as a document of fields, or null when it is not one. */
function documentOf(stored: string | null): Login | null {
  try {
    const parsed = stored ? (JSON.parse(stored) as unknown) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Login)
      : null;
  } catch {
    return null;
  }
}

/** The fields of a login its adapter declares; every field when no list of them is known. */
const declaredOnly = (login: Login, declared: readonly string[] | null | undefined): Login =>
  declared
    ? Object.fromEntries(Object.entries(login).filter(([key]) => declared.includes(key)))
    : login;

/** The keys of the login fields a provider's adapter declares, or null when none is registered. */
const declaredKeys = (provider: string): string[] | null =>
  adminFor(provider)?.credentials.map((field) => field.key) ?? null;

/**
 * The login to use: null when nothing is typed (the stored one stays as it is), else the typed
 * fields over the stored ones the adapter still declares. A stored login that is not a JSON
 * document gives way to the typed.
 */
export function mergedLogin(
  typed: Record<string, string> | null | undefined,
  stored: string | null,
  provider?: string,
): string | null {
  const fields = Object.fromEntries(
    Object.entries(typed ?? {}).filter(([, value]) => value !== ''),
  );
  if (Object.keys(fields).length === 0) return null;
  const before = declaredOnly(documentOf(stored) ?? {}, provider ? declaredKeys(provider) : null);
  return JSON.stringify({ ...before, ...fields });
}

/**
 * Drop from every stored login the fields its adapter no longer declares. A connection whose
 * adapter is not registered in this process is left alone, and so is a login that would keep no
 * field at all: nothing here ever empties a login.
 */
export async function dropUndeclaredLoginFields(): Promise<void> {
  for (const row of await connections()) {
    const declared = declaredKeys(row.provider);
    if (!declared || !row.has_credentials) continue;
    const connection = await connectionById(row.id);
    const login = documentOf(connection?.credentials ?? null);
    if (!connection || !login) continue;
    const kept = declaredOnly(login, declared);
    const count = Object.keys(kept).length;
    if (count === 0 || count === Object.keys(login).length) continue;
    await upsertConnection({
      id: connection.id,
      tenantId: connection.tenantId,
      provider: connection.provider,
      credentials: JSON.stringify(kept),
      licensedOffices: connection.licensedOffices,
      active: connection.active,
    });
  }
}
