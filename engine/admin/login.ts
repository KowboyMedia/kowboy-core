// A connection's login as a save or "Check the login" uses it: the fields typed now over the
// fields stored before, so typing one field never loses the others (known bug 3, fixed
// 2026-10-06). The login is one JSON document of fields, the adapter's to read; nothing here
// knows a CRM.

/**
 * The login to use: null when nothing is typed (the stored one stays as it is), else the typed
 * fields over the stored ones. A stored login that is not a JSON document gives way to the typed.
 */
export function mergedLogin(
  typed: Record<string, string> | null | undefined,
  stored: string | null,
): string | null {
  const fields = Object.fromEntries(
    Object.entries(typed ?? {}).filter(([, value]) => value !== ''),
  );
  if (Object.keys(fields).length === 0) return null;
  let before: Record<string, unknown> = {};
  try {
    const parsed = stored ? (JSON.parse(stored) as unknown) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      before = parsed as Record<string, unknown>;
    }
  } catch {
    // not a document: the typed fields replace it
  }
  return JSON.stringify({ ...before, ...fields });
}
