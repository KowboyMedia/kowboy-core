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

// ---- Forms (docs/forms.md): what a site's visitor sends, as this CRM takes it -------------------
//
// This CRM has its own vocabulary for a form too: a CONTACT, an INTEREST, a SHOWING_BOOKING and a
// WATCH, with the person's fields under its own names, and showings with times a visitor books.

export type Form = { form: string; payload: Record_ };

const forms: Form[] = [];
let nextAnswer: { refuse?: string; fail?: string } | null = null;
const showings = new Map<string, Record_[]>();

/** Every form this CRM took, oldest first, as it received them. */
export const formsTaken = (): Form[] => [...forms];

/** Make the CRM answer the next form with a refusal (its reason) or a failure (no answer). */
export const answerNext = (answer: { refuse?: string; fail?: string } | null): void => {
  nextAnswer = answer;
};

export const takeForm = (
  form: string,
  payload: Record_,
): { taken: true; contact_no: string } | { taken: false; why: string } => {
  const answer = nextAnswer;
  nextAnswer = null;
  if (answer?.fail) throw new Error(answer.fail);
  if (answer?.refuse) return { taken: false, why: answer.refuse };
  forms.push({ form, payload });
  return { taken: true, contact_no: `C-${String(forms.length)}` };
};

/** The showings of one object, with the times a visitor can book. */
export const setShowings = (objectId: string, list: Record_[]): void => {
  showings.set(objectId, list);
};

export const showingsOf = (objectId: string): Record_[] => showings.get(objectId) ?? [];

export const reset = (): void => {
  store.clear();
  forms.length = 0;
  nextAnswer = null;
  showings.clear();
};
