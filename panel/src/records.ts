// Records by their formal names (property, project, agent, office, area, association), counted.
import type { ConnectionView } from './api';
import { counted } from './time';

type Datatype = keyof ConnectionView['counts'];

const NAMES: Record<Datatype, [string, string]> = {
  property: ['property', 'properties'],
  project: ['project', 'projects'],
  agent: ['agent', 'agents'],
  office: ['office', 'offices'],
  area: ['area', 'areas'],
  association: ['association', 'associations'],
};

/** "61 properties", "1 agent". */
export const records = (n: number, datatype: Datatype, before = ''): string => {
  const [one, many] = NAMES[datatype];
  return counted(n, `${before}${one}`, `${before}${many}`);
};

/** The order B counts a CRM's data in (image 10); offices are named, not counted. */
const LOADED: Datatype[] = ['property', 'agent', 'area', 'project', 'association'];

/** "61 properties · 14 agents · 9 areas · 2 projects · 17 associations": the types it holds. */
export const loadedLine = (counts: ConnectionView['counts']): string =>
  LOADED.filter((datatype) => counts[datatype] > 0)
    .map((datatype) => records(counts[datatype], datatype))
    .join(' · ');

/** The same types as a list in a sentence: "12 properties, 3 agents". */
export const loadedList = (counts: ConnectionView['counts']): string[] =>
  LOADED.filter((datatype) => counts[datatype] > 0).map((datatype) =>
    records(counts[datatype], datatype),
  );

/** The one CRM's name, as its code gives it, or "the CRMs" when Core reads several or none. */
export const crmOf = (crms: string[]): string => (crms.length === 1 ? (crms[0] ?? '') : 'the CRMs');

/** "<CRM> id" for the one CRM Core reads, or "CRM id" when it reads several. */
export const idWord = (crms: string[]): string =>
  crms.length === 1 ? `${crms[0] ?? ''} id` : 'CRM id';

/** A record's page in the panel. */
export const recordPath = (record: { connection: string; datatype: string; id: string }): string =>
  `/records/${[record.connection, record.datatype, record.id].map(encodeURIComponent).join('/')}`;
