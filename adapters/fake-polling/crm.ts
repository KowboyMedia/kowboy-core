// A second stand-in CRM with a different payload shape, so nothing in the engine can depend on
// one provider's vocabulary.
type Record_ = Record<string, unknown>;

const store = new Map<string, Map<string, Record_>>();

const bucket = (datatype: string): Map<string, Record_> => {
  const existing = store.get(datatype);
  if (existing) return existing;
  const created = new Map<string, Record_>();
  store.set(datatype, created);
  return created;
};

export const put = (datatype: string, id: string, payload: Record_): void => {
  bucket(datatype).set(id, { ...payload, changed_at: new Date().toISOString() });
};

export const remove = (datatype: string, id: string): void => {
  bucket(datatype).delete(id);
};

export const all = (datatype: string): Record_[] => [...bucket(datatype).values()];

export const ids = (datatype: string): string[] => [...bucket(datatype).keys()];

export const reset = (): void => store.clear();
