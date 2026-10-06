// The scope every list and run is narrowed by (Patric, 2026-10-06): tenants, offices, entity
// types and one record id, the same on Records, Flow and Manual sync. It lives in the address,
// so a scoped view is a link, and it is sent to Core as the admin API takes it.

export type Scope = {
  tenantIds: number[];
  officeIds: string[];
  datatypes: string[];
  remoteId: string;
};

export const EMPTY_SCOPE: Scope = { tenantIds: [], officeIds: [], datatypes: [], remoteId: '' };

const list = (params: URLSearchParams, key: string): string[] =>
  (params.get(key) ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

/**
 * The scope as the address carries it: `tenant=1,2&office=A,B&datatype=property&id=OBJ-1`. The
 * id stays as typed, so the box keeps what a person types; what is sent to Core is trimmed.
 */
export function readScope(params: URLSearchParams): Scope {
  return {
    tenantIds: list(params, 'tenant')
      .map(Number)
      .filter((id) => Number.isInteger(id)),
    officeIds: list(params, 'office'),
    datatypes: list(params, 'datatype'),
    remoteId: params.get('id') ?? '',
  };
}

/** The record id without the spaces a paste brings around it. */
const idOf = (scope: Scope): string => scope.remoteId.trim();

/** The address with this scope in it; an empty box leaves its key out. */
export function writeScope(params: URLSearchParams, scope: Scope): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string): void => {
    if (value === '') next.delete(key);
    else next.set(key, value);
  };
  set('tenant', scope.tenantIds.join(','));
  set('office', scope.officeIds.join(','));
  set('datatype', scope.datatypes.join(','));
  set('id', scope.remoteId);
  return next;
}

/** The scope as a query string for a list call. */
export const scopeQuery = (scope: Scope): Record<string, string> =>
  Object.fromEntries(writeScope(new URLSearchParams(), { ...scope, remoteId: idOf(scope) }));

/** The scope as a run's body. Only what was picked is sent. */
export function scopeBody(scope: Scope): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (scope.tenantIds.length > 0) body['tenantIds'] = scope.tenantIds;
  if (scope.officeIds.length > 0) body['officeIds'] = scope.officeIds;
  if (scope.datatypes.length > 0) body['datatypes'] = scope.datatypes;
  if (idOf(scope) !== '') body['remoteId'] = idOf(scope);
  return body;
}

export const isEverything = (scope: Scope): boolean =>
  scope.tenantIds.length === 0 &&
  scope.officeIds.length === 0 &&
  scope.datatypes.length === 0 &&
  idOf(scope) === '';

/** What the pickers offer, as `GET /scope` answers. */
export type ScopeOptions = {
  tenants: { id: number; name: string }[];
  offices: { tenantId: number; id: string; name: string | null }[];
  datatypes: string[];
};

export const tenantName = (options: ScopeOptions, id: number | null): string =>
  options.tenants.find((tenant) => tenant.id === id)?.name ?? (id === null ? '—' : String(id));

/**
 * An office as a person knows it: its name, then its id. Two tenants can hold the same office id
 * under different names, so the name is the one the given tenant's records use when there is one.
 */
export function officeLabel(
  options: ScopeOptions,
  id: string | null,
  tenantId: number | null = null,
): string {
  if (id === null) return '—';
  const same = options.offices.filter((office) => office.id === id);
  const name = (same.find((office) => office.tenantId === tenantId) ?? same[0])?.name;
  return name ? `${name} (${id})` : id;
}

const few = (names: string[]): string =>
  names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} and ${String(names.length - 3)} more`;

/** The scope in words, for a confirmation: what a run will touch. */
export function sayScope(scope: Scope, options: ScopeOptions): string {
  if (isEverything(scope)) return 'every record in Core';
  const parts: string[] = [];
  if (idOf(scope) !== '') parts.push(`the record ${idOf(scope)}`);
  if (scope.datatypes.length > 0) parts.push(`the ${few(scope.datatypes)} records`);
  if (scope.officeIds.length > 0)
    parts.push(
      `${scope.officeIds.length === 1 ? 'the office' : 'the offices'} ${few(scope.officeIds.map((id) => officeLabel(options, id)))}`,
    );
  if (scope.tenantIds.length > 0)
    parts.push(
      `${scope.tenantIds.length === 1 ? 'the tenant' : 'the tenants'} ${few(scope.tenantIds.map((id) => tenantName(options, id)))}`,
    );
  return parts.join(' of ');
}
