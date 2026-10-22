import { createHash } from 'node:crypto';

/** JSON with object keys sorted, so the same value always produces the same bytes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

/**
 * A payload as Postgres can store it. Its JSON refuses the character U+0000 ("unsupported Unicode
 * escape sequence"), which a CRM's text can hold invisibly, so the engine drops it from every
 * text and key before anything is mapped or stored; nothing else in the payload changes.
 */
export function storable(value: unknown): unknown {
  if (typeof value === 'string') return value.replaceAll('\u0000', '');
  if (Array.isArray(value)) return value.map(storable);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key.replaceAll('\u0000', ''), storable(inner)]),
  );
}

/**
 * Change detection hash of a canonical `data` object.
 * `provider_extras` is excluded on purpose (SRS §6.4): provider-only fields must not cause a new
 * `seq`, a bell or a client write.
 */
export function contentHash(data: Record<string, unknown>): string {
  const { provider_extras: _ignored, ...hashed } = data;
  return createHash('sha256').update(canonicalJson(hashed)).digest('hex');
}
