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

/**
 * Names in a sentence: "A", "A and B", "A, B and C", or the first three and how many more. Names
 * that hold a comma themselves ("Acme’s Somecrm connection, short name acme-crm") are parted by
 * semicolons, so each stays one name.
 */
export function listed(names: string[], limit = 3): string {
  const apart = names.some((name) => name.includes(',')) ? '; ' : ', ';
  const last = apart === '; ' ? '; and ' : ' and ';
  if (names.length > limit)
    return `${names.slice(0, limit).join(apart)}${last}${counted(names.length - limit, 'more', 'more')}`;
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(apart)}${last}${names[names.length - 1] ?? ''}`;
}

/** A length of time in words, rounded down: "40 seconds", "12 minutes", "3 hours", "2 days". */
export function lasting(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return counted(seconds, 'second', 'seconds');
  if (seconds < 3_600) return counted(Math.floor(seconds / 60), 'minute', 'minutes');
  if (seconds < 172_800) return counted(Math.floor(seconds / 3_600), 'hour', 'hours');
  return counted(Math.floor(seconds / 86_400), 'day', 'days');
}

/** A phrase as a sentence of its own: a capital first, a full stop last. */
export function sentence(phrase: string): string {
  const trimmed = phrase.trim();
  return capital(/[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`);
}

/** A number in a sentence: one in words, the rest in figures ("one field", "12 fields"). */
export const inWords = (value: number, one: string, many: string): string =>
  value === 1 ? `one ${one}` : counted(value, one, many);

/** A connection by its tenant and CRM, then its short name: "Acme’s Somecrm connection, short name acme-crm". */
export const connectionNamed = (
  id: string,
  tenant?: string | null,
  provider?: string | null,
): string =>
  tenant && provider
    ? `${tenant}’s ${crmName(provider)} connection, short name ${id}`
    : `the connection with the short name ${id}`;

/** An office by its tenant and name, then the CRM's id for it: "Acme’s office Lidingö (the CRM’s office id 100)". */
export function officeNamed(id: string, name?: string | null, tenant?: string | null): string {
  const office = name
    ? `office ${name} (the CRM’s office id ${id})`
    : `office with the CRM’s office id ${id}`;
  return tenant ? `${tenant}’s ${office}` : `the ${office}`;
}

/** A site by its tenant, then its name: "Acme’s site acme.se". */
export const siteNamed = (label: string, tenant?: string | null): string =>
  tenant ? `${tenant}’s site ${label}` : `the site ${label}`;

const CLOCK = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** A moment as the admin area writes it, in Stockholm time: "2026-10-06 21:42". */
export const clock = (at: Date): string => CLOCK.format(at);

/** A text's first sentence, for a subject line or a quote: up to the first full stop before a space. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  return /^(.+?[.!?])(?:\s|$)/.exec(trimmed)?.[1] ?? trimmed;
}

/** A name that starts with an article, taken into a sentence: "The site acme.se" becomes "the site acme.se". */
export const inSentence = (phrase: string): string =>
  phrase.replace(/^(The|A|An) /, (article) => article.toLowerCase());
