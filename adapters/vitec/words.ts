// The words of the Vitec checks and events, for a cold reader (AGENTS.md, definition of done 5).
// The engine keeps its own in engine/admin/words.ts, which an adapter may not import, so the few
// these need are copied here and read the same: "1 connection", "3 connections", "12 minutes".
import * as connect from './api.js';
import type { Office } from './store.js';
import type { HealthResult } from '../../engine/adapter-api/index.js';

/**
 * A connection, an office it fetches or one of its records, by their ids: Core names it as the
 * admin area does everywhere and links it to its place (question 184).
 */
export type AdminThing = Exclude<NonNullable<HealthResult['names']>[number], string>;

/** A number with its noun, agreeing with it: "1 office", "12 offices", never "office(s)". */
export const counted = (value: number, one: string, many: string): string =>
  `${value.toLocaleString('sv-SE')} ${value === 1 ? one : many}`;

/** One word or the other, by how many things a sentence is about. */
export const agree = (value: number, one: string, many: string): string =>
  value === 1 ? one : many;

/** A length of time in words, rounded down: "40 seconds", "12 minutes", "3 hours", "2 days". */
export function lasting(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return counted(seconds, 'second', 'seconds');
  if (seconds < 3_600) return counted(Math.floor(seconds / 60), 'minute', 'minutes');
  if (seconds < 172_800) return counted(Math.floor(seconds / 3_600), 'hour', 'hours');
  return counted(Math.floor(seconds / 86_400), 'day', 'days');
}

/** An office as a person knows it: its name as Vitec gave it, then Vitec's id for it. */
export function officeNamed({ environment, officeId }: Office, name?: string | null): string {
  const id = `Vitec’s ${environment === 'qa' ? 'QA office id' : 'office id'} ${officeId}`;
  return name ? `${name} (${id})` : id;
}

/** A record's type as the sites' readers know it; the engine's own words are not the adapter's. */
const RECORD_WORDS: Record<string, string> = {
  property: 'home',
  project: 'new-build project',
  agent: 'agent',
  office: 'office',
  area: 'area',
  association: 'housing cooperative',
};
export const recordNamed = (datatype: string): string => RECORD_WORDS[datatype] ?? 'record';

/** A Swedish date and time for a sentence: `2026-10-06 14:31`, Stockholm time. */
export const when = (iso: string | Date): string =>
  new Date(iso)
    .toLocaleString('sv-SE', {
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');

/** Vitec's answer code, kept at the end of an error for whoever phones Vitec. */
const code = (status: number): string => `Vitec’s answer code was ${String(status)}`;

/**
 * What went wrong with a call to Vitec, as a clause that follows "because": the kind of failure
 * in words, then Vitec's answer code. The event log and the error tracker keep the path and the
 * raw answer for an engineer; a person reads this.
 */
/**
 * Vitec answered, and Core could not save what it sent (a home's connection removed while it was
 * fetched, say): the fetch is tried again, and its words never blame Vitec.
 */
export class NotSaved extends Error {
  constructor(cause: unknown) {
    super(`Core could not save what Vitec sent: ${String(cause)}`, { cause });
    this.name = 'NotSaved';
  }
}

export function failureInWords(error: unknown): string {
  if (error instanceof NotSaved) return 'Vitec answered, but Core could not save what it sent';
  if (error instanceof connect.Blocked) {
    return `Vitec refuses to let this login read the office with Vitec’s office id ${error.officeId}${error.environment === 'qa' ? ' in its QA environment' : ''}, so Core did not ask`;
  }
  if (error instanceof connect.VitecError) return answerInWords(error);
  const name = error instanceof Error ? error.name : '';
  if (name === 'TimeoutError' || name === 'AbortError')
    return 'Vitec did not answer within 30 seconds';
  if (name === 'TypeError') return 'Core could not reach Vitec';
  return 'the call to Vitec failed';
}

/** What Vitec answered, when it answered with an error. */
function answerInWords(error: connect.VitecError): string {
  if (error.broken) return 'Vitec answered with something Core cannot read';
  if (error.status === 401 || error.status === 403)
    return `Vitec does not let this login read it, and ${code(error.status)}`;
  if (error.status === 429) return `Vitec asked Core to call less often, and ${code(429)}`;
  if (error.status >= 500) return `Vitec’s service did not work, and ${code(error.status)}`;
  return error.said
    ? `Vitec turned the call down with the words “${error.said}”, and ${code(error.status)}`
    : `Vitec turned the call down without giving a reason, and ${code(error.status)}`;
}

/** A clause as a sentence of its own: capitalised, with its full stop. */
export const sentence = (clause: string): string =>
  `${clause.charAt(0).toUpperCase()}${clause.slice(1)}${/[.!?]$/.test(clause) ? '' : '.'}`;
