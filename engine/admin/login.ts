// A connection's login as a save or "Check the login" uses it: the fields typed now over the
// fields stored before, so typing one field never loses the others (known bug 3, fixed
// 2026-10-06). The login is one JSON document of fields, the adapter's to read; nothing here
// knows a CRM. A stored field the adapter no longer declares is dropped at the next save
// (Patric's rule for a removed feature, 2026-10-06: the data it kept goes too).
import { adminFor } from '../registry.js';
import { connectionsForProvider, upsertConnection } from '../storage/connections.js';

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

/** What the page shows of a stored login, field by field. */
export type ShownLogin = {
  /** The stored value of each field that is not secret and holds one. */
  shown: Record<string, string>;
  /** Every declared field that holds a value, secret or not. */
  filled: string[];
};

/**
 * A stored login as the tenant page shows it, per field its adapter declares: a field that is not
 * secret shows what is stored, so an empty one looks empty; a secret one only says that it holds
 * something, since a secret never leaves the server.
 */
export function shownLogin(stored: string | null, provider: string): ShownLogin {
  const login = documentOf(stored) ?? {};
  const result: ShownLogin = { shown: {}, filled: [] };
  for (const field of adminFor(provider)?.credentials ?? []) {
    const value = login[field.key];
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue;
    }
    if (String(value).trim() === '') continue;
    result.filled.push(field.key);
    if (!field.secret) result.shown[field.key] = String(value);
  }
  return result;
}

/**
 * Remove exactly the named fields from every stored login of one provider, for fields its adapter
 * dropped. A login without them is left untouched, and a login is never emptied. A one-time step:
 * its caller goes once every environment's stored logins are clean. Returns how many logins changed.
 */
export async function removeLoginFields(
  provider: string,
  keys: readonly string[],
): Promise<number> {
  let changed = 0;
  for (const connection of await connectionsForProvider(provider)) {
    const login = documentOf(connection.credentials);
    if (!login) continue;
    const kept = Object.fromEntries(Object.entries(login).filter(([key]) => !keys.includes(key)));
    const count = Object.keys(kept).length;
    if (count === 0 || count === Object.keys(login).length) continue;
    await upsertConnection({
      id: connection.id,
      tenantId: connection.tenantId,
      provider: connection.provider,
      credentials: JSON.stringify(kept),
      licensedOffices: connection.licensedOffices,
    });
    changed += 1;
  }
  return changed;
}
