// The admin area's words for numbers, entity types and CRMs, in one place for the engine's answers
// and the app's pages alike (docs/admin-panel.md, "The words it uses"; AGENTS.md, definition of
// done 5: every text is written for a cold reader).

/** A number as Sweden groups it: 12 345. */
export const number = (value: number): string => value.toLocaleString('sv-SE');

/** A number with its noun, agreeing with it: "1 site", "12 sites", never "site(s)". */
export const counted = (value: number, one: string, many: string): string =>
  `${number(value)} ${value === 1 ? one : many}`;

/** Each entity type as a reader says it, one and many. */
const ENTITY: Record<string, readonly [string, string]> = {
  property: ['home', 'homes'],
  project: ['new-build project', 'new-build projects'],
  agent: ['agent', 'agents'],
  office: ['office', 'offices'],
  area: ['area', 'areas'],
  association: ['housing cooperative', 'housing cooperatives'],
};

/** An entity type in words, one ("home") or many ("homes"); a type nobody named stays as it is. */
export const entity = (datatype: string, many = false): string =>
  ENTITY[datatype]?.[many ? 1 : 0] ?? datatype;

/** One record of an entity type, with its article: "a home", "an agent". */
export const anEntity = (datatype: string): string => {
  const word = entity(datatype);
  return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;
};

/** A number of one entity type: "1 home", "12 homes". */
export const entities = (value: number, datatype: string): string =>
  `${number(value)} ${entity(datatype, value !== 1)}`;

/** A CRM by its name: its provider with a capital first letter. */
export const crmName = (provider: string): string =>
  provider.charAt(0).toUpperCase() + provider.slice(1);

/** The first letter in capitals, for a phrase that starts a sentence or a label. */
export const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Names in a sentence: "A", "A and B", "A, B and C", or the first three and how many more. */
export function listed(names: string[], limit = 3): string {
  if (names.length > limit)
    return `${names.slice(0, limit).join(', ')} and ${counted(names.length - limit, 'more', 'more')}`;
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}
