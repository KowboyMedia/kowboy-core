// The words of the Vitec checks and events, for a cold reader (AGENTS.md, definition of done 5).
// The engine keeps its own in engine/words.ts, which an adapter may not import, so the few
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

/**
 * Vitec's answer code and its own words for the error, when it gave words rather than a web page:
 * kept at the end of an error for whoever reports it to Vitec.
 */
function answered(error: connect.VitecError): string {
  const code = `Vitec’s answer code ${String(error.status)}`;
  return error.said ? `, with ${code} and the words “${quotable(error.said)}”` : `, with ${code}`;
}

/** A call that gave up waiting for Vitec's answer. */
const timedOut = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

/**
 * A call that never reached Vitec: fetch fails so, with the network's reason as its cause. Any
 * other TypeError is a fault in Core's own code.
 */
const unreached = (error: unknown): error is TypeError =>
  error instanceof TypeError && error.message === 'fetch failed';

/** Words to quote inside a sentence: one line, short, without a full stop of their own. */
const quotable = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .slice(0, 200)
    .replace(/[\s.]+$/, '')
    .trim();

/** An error's own words, for whoever it is passed on to. */
const ownWords = (error: unknown): string =>
  quotable(error instanceof Error ? error.message : String(error));

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

/**
 * What went wrong with a call to Vitec, as a clause that follows "because": the kind of failure
 * in words, then the answer code and the words of whoever failed, Vitec or Core, so the reader can
 * tell whose it is and pass it on (Patric, 2026-10-18). The event log and the error tracker keep
 * the path and the raw answer for an engineer; a person reads this.
 */
export function failureInWords(error: unknown): string {
  if (error instanceof NotSaved) {
    return `Vitec answered, but Core could not save what it sent, and Core’s error said “${ownWords(error.cause)}”`;
  }
  if (error instanceof connect.Blocked) {
    return `Vitec refuses to let this login read the office with Vitec’s office id ${error.officeId}${error.environment === 'qa' ? ' in its QA environment' : ''}, so Core did not ask`;
  }
  if (error instanceof connect.VitecError) return answerInWords(error);
  if (timedOut(error)) return 'Vitec did not answer within 30 seconds';
  if (unreached(error)) {
    return error.cause
      ? `Core could not reach Vitec, and the network said “${ownWords(error.cause)}”`
      : 'Core could not reach Vitec';
  }
  return `Core could not make the call to Vitec, and Core’s error said “${ownWords(error)}”`;
}

/** What Vitec answered, when it answered with an error. */
function answerInWords(error: connect.VitecError): string {
  if (error.broken) return 'Vitec answered with something Core cannot read';
  if (error.status === 401 || error.status === 403)
    return `Vitec does not let this login read it${answered(error)}`;
  if (error.status === 429) return `Vitec asked Core to call less often${answered(error)}`;
  if (error.status >= 500) return `Vitec’s service did not work${answered(error)}`;
  return error.said
    ? `Vitec turned the call down${answered(error)}`
    : `Vitec turned the call down without giving a reason${answered(error)}`;
}

/** Whose a failure is: Core's, Vitec's, the login's, or a slow-down or break that passes. */
type Whose = 'core' | 'vitec' | 'slow' | 'network' | 'login' | 'throttled' | 'call';

const TO_DO: Record<Whose, string> = {
  core: 'This is a fault in Core, not at Vitec or in the login, so pass it on to Core’s developers.',
  vitec:
    'This is a fault at Vitec, not in Core or the login. If it still fails after a retry, report it to Vitec’s support with the record’s Vitec id and what Vitec answered.',
  slow: 'This is Vitec being slow or down, not Core or the login. If it still fails after a retry, ask Vitec’s support whether their service works.',
  network:
    'This is most often a short break at Vitec or on the way there, and Core tries again by itself. If it lasts for hours, pass it on to Core’s developers.',
  login:
    'This is the login, not Core or Vitec’s service: check with the brokerage that it may still read this office in Vitec, and enter the new login if it changed.',
  throttled: 'Core calls less often by itself, so nothing needs doing.',
  call: 'Vitec turned down the call Core made, so pass it on to Core’s developers, who can tell whether Core asked wrongly or the record is wrong at Vitec.',
};

/** Whose a failed answer of Vitec's is. */
function answerWhose(error: connect.VitecError): Whose {
  if (error.broken || error.status >= 500) return 'vitec';
  if (error.status === 401 || error.status === 403) return 'login';
  return error.status === 429 ? 'throttled' : 'call';
}

function whose(error: unknown): Whose | null {
  if (error instanceof connect.Blocked) return null;
  if (error instanceof connect.VitecError) return answerWhose(error);
  if (error instanceof NotSaved || !(error instanceof Error)) return 'core';
  if (timedOut(error)) return 'slow';
  return unreached(error) ? 'network' : 'core';
}

/**
 * Whose a failed fetch of a record is, and what to do, as sentences that follow its cause: a fault
 * in Core goes to Core's developers, a fault at Vitec to Vitec's support with the record's id, and
 * a login Vitec refuses to the brokerage (Patric, 2026-10-18: "should I bug report it to you or
 * Vitec or is credentials incorrect"). A refused office says it all in its cause.
 */
export function whatToDo(error: unknown): string {
  const side = whose(error);
  return side ? TO_DO[side] : '';
}

/** A clause as a sentence of its own: capitalised, with its full stop. */
export const sentence = (clause: string): string =>
  `${clause.charAt(0).toUpperCase()}${clause.slice(1)}${/[.!?]$/.test(clause) ? '' : '.'}`;
