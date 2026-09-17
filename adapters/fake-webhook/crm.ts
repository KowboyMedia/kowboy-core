// A stand-in for a CRM's HTTP API. A real adapter would do authentication, HTTP and rate limits
// here; nothing outside this adapter knows the shape below.
export type FakeRecord = { id: string; payload: Record<string, unknown> };

type Store = Map<string, Map<string, Record<string, unknown>>>;

const store: Store = new Map();

const bucket = (datatype: string): Map<string, Record<string, unknown>> => {
  const existing = store.get(datatype);
  if (existing) return existing;
  const created = new Map<string, Record<string, unknown>>();
  store.set(datatype, created);
  return created;
};

export const put = (datatype: string, id: string, payload: Record<string, unknown>): void => {
  bucket(datatype).set(id, payload);
};

export const remove = (datatype: string, id: string): void => {
  bucket(datatype).delete(id);
};

export const get = (datatype: string, id: string): Record<string, unknown> | null =>
  bucket(datatype).get(id) ?? null;

export const ids = (datatype: string): string[] => [...bucket(datatype).keys()];

export const reset = (): void => store.clear();
