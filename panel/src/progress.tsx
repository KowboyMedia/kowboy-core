// How a CRM connection is coming along (design B rows 33, 41, 56, 64, 71, 75, 91 and 111): what to
// ask the CRM's admin for until the CRM's first notice comes, how far the first load has come, and
// what an office check found and changed. Every word of a step, of why an office stays off and of
// how changes arrive meanwhile is the CRM's code's; the panel only places them.
import { useState } from 'react';
import type { AddedOffice, Progress, ShownStep, ShownValue } from './api';
import { Shown } from './sections';
import { counted, listed, when } from './time';
import { records } from './records';
import { masked, ValueField } from './ui';
import { AlertCircleIcon, AlertTriangleIcon, CheckIcon, CopyIcon } from './icons';

export type OfficeCheck = NonNullable<Progress['officeCheck']>;
export type FirstLoad = NonNullable<Progress['firstLoad']>;

/** A sentence's end as the CRM's code gave it, closed with a full stop when it has none. */
export const ended = (text: string): string =>
  /[.!?][”’"')]*$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;

/** Changes reach "the website", "the websites", or the websites by name. */
export const reachWords = (sites: string[], named: boolean): string =>
  named && sites.length > 0 ? listed(sites) : sites.length > 1 ? 'the websites' : 'the website';

// ---- Offices --------------------------------------------------------------------------------------

/** "Kungsbacka stays off: it isn’t in …", one clause for each reason, the offices it keeps off. */
function offClauses(off: OfficeCheck['off']): string[] {
  const byWhy = new Map<string, string[]>();
  for (const one of off) byWhy.set(one.why, [...(byWhy.get(one.why) ?? []), one.name]);
  return [...byWhy].map(
    ([why, names]) =>
      `${listed(names)} ${names.length === 1 ? 'stays' : 'stay'} off: ${why.trim().replace(/\.$/, '')}`,
  );
}

/** "Kungsbacka stays off: it isn’t in …." as whole sentences; empty when every office is on. */
export const offWords = (off: OfficeCheck['off']): string => offClauses(off).map(ended).join(' ');

/** "Offices on the website: Varberg, Falkenberg", with the names joined as the place asks. */
export function officesOnTitle(check: OfficeCheck, join: (names: string[]) => string): string {
  const names = check.on.map((one) => one.name);
  if (names.length === 0) return 'No office is on the website';
  return `${names.length === 1 ? 'Office' : 'Offices'} on the website: ${join(names)}`;
}

/** "Offices on the website: Varberg and Falkenberg. Kungsbacka stays off: …." */
export const officesOnWords = (check: OfficeCheck): string =>
  [`${officesOnTitle(check, listed)}.`, offWords(check.off)].filter(Boolean).join(' ');

/** "both offices OK", "2 of 3 offices OK; Kungsbacka stays off: …". */
function officesOk(check: OfficeCheck): string {
  const on = check.on.length;
  if (check.off.length > 0) {
    return [
      `${String(on)} of ${counted(on + check.off.length, 'office', 'offices')} OK`,
      ...offClauses(check.off),
    ].join('; ');
  }
  if (on === 0) return 'no office is on the websites';
  if (on === 1) return 'the office is OK';
  if (on === 2) return 'both offices OK';
  return `all ${String(on)} offices OK`;
}

/**
 * What a changed login's save says once Core checked the connection's offices (row 33): "<CRM>
 * accepted the new login. Office check done: both offices OK. Changes held since 06:02 are being
 * fetched.", the last only when the save let held changes go.
 */
export function loginCheckedWords(
  crm: string,
  check: OfficeCheck,
  heldBefore: string | null,
  heldAfter: string | null,
  now: Date,
): string {
  const held =
    heldBefore && !heldAfter
      ? ` Changes held since ${when(heldBefore, now)} are being fetched.`
      : '';
  return `${crm} accepted the new login. Office check done: ${ended(officesOk(check))}${held}`;
}

/** What an office the check added came to, as the rest of "Täby added, …". */
function addedWords(office: AddedOffice, websites: number): string {
  const its = records(office.properties, 'property');
  const are = office.properties === 1 ? 'is' : 'are';
  if (office.waiting !== null && office.waiting > 0) {
    const so = office.properties > 0 ? ` (${its} so far)` : '';
    return `${office.name} added, and Core is still loading its properties${so}.`;
  }
  if (office.properties === 0) return `${office.name} added; it has no properties.`;
  if (websites === 0) return `${office.name} added, with its ${its}.`;
  if (office.websites >= websites) {
    const sites =
      websites === 1
        ? 'the website'
        : websites === 2
          ? 'both websites'
          : `all ${String(websites)} websites`;
    return `${office.name} added, and its ${its} ${are} on ${sites}.`;
  }
  if (office.websites === 0) {
    return `${office.name} added; its ${its} reach ${websites === 1 ? 'the website at its' : 'the websites at their'} next fetch.`;
  }
  return `${office.name} added, and its ${its} ${are} on ${String(office.websites)} of ${String(websites)} websites; the others get them at their next fetch.`;
}

/**
 * What a check someone started from the tenant's page found (row 111): "Office check done: Täby
 * added, and its 17 properties are on both websites.", an office taken off, or no change.
 */
export function checkDoneWords(check: OfficeCheck, websites: number): string {
  const parts = check.added.map((office) => addedWords(office, websites));
  if (check.removed.length > 0) {
    parts.push(
      `${listed(check.removed)} taken off ${websites === 1 ? 'the website' : 'the websites'}.`,
    );
  }
  return `Office check done: ${parts.length > 0 ? parts.join(' ') : 'no change.'}`;
}

// ---- The first load -------------------------------------------------------------------------------

const total = (counts: Record<string, number>): number =>
  Object.values(counts).reduce((sum, n) => sum + n, 0);

/**
 * How far the first load has come (row 64): "Loading data, 38 of 61 properties", or "Loading
 * data" alone while the CRM lists nothing yet; null once it is done.
 */
export function loading(load: FirstLoad): { words: string; done: number; of: number } | null {
  if (load.done) return null;
  if (load.listed.property > 0) {
    return {
      words: `Loading data, ${String(load.loaded.property)} of ${records(load.listed.property, 'property')}`,
      done: load.loaded.property,
      of: load.listed.property,
    };
  }
  const of = total(load.listed);
  if (of === 0) return { words: 'Loading data', done: 0, of: 0 };
  const done = total(load.loaded);
  return {
    words: `Loading data, ${String(done)} of ${counted(of, 'record', 'records')}`,
    done,
    of,
  };
}

export function ProgressBar({ done, of }: { done: number; of: number }) {
  return (
    <div
      className="k-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={of}
      aria-valuenow={done}
    >
      <span style={{ width: `${String(of === 0 ? 0 : Math.round((done / of) * 100))}%` }} />
    </div>
  );
}

// ---- What to ask the CRM's admin for ------------------------------------------------------------

const NUMBERS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "the step", "both steps", "all four steps". */
function allSteps(n: number): string {
  if (n === 1) return 'the step';
  if (n === 2) return 'both steps';
  return `all ${NUMBERS[n] ?? String(n)} steps`;
}

const isAddress = (value: ShownValue): boolean =>
  typeof value === 'string' && /^https?:\/\//.test(value);

/** A secret address keeps its start and hides its end, as a token field hides all but four. */
function hidden(value: string): string {
  const start = /^https?:\/\/[^/]+\/(?:.*\/)?/.exec(value)?.[0];
  return start ? `${start}${masked(value.slice(start.length))}` : masked(value);
}

/** A value as plain text for the copied instructions; a moment is left out. */
function plain(value: ShownValue): string | null {
  if (value === null) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return 'state' in value ? value.text : null;
}

/** Every step numbered, with its value in full under it. */
export const instructions = (steps: ShownStep[]): string =>
  steps
    .map((step, index) => {
      const value = plain(step.value);
      return `${String(index + 1)}. ${step.text}${value ? `\n   ${value}` : ''}`;
    })
    .join('\n');

function CopyInstructions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };
  return (
    <button
      type="button"
      className="k-button k-button-quiet k-button-small k-ask-copy"
      onClick={copy}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {copied ? 'Copied' : 'Copy instructions'}
    </button>
  );
}

const NOTE_ICONS: Record<'ok' | 'bad' | 'warn' | 'muted', typeof CheckIcon | null> = {
  ok: CheckIcon,
  bad: AlertCircleIcon,
  warn: AlertTriangleIcon,
  muted: null,
};

function Step({ step, n, now }: { step: ShownStep; n: number; now: Date }) {
  const value = step.value;
  const Icon = step.note ? NOTE_ICONS[step.note.state] : null;
  return (
    <li className="k-ask-step">
      <span className="k-ask-n">{n}</span>
      <div className="k-ask-body">
        <p className="k-ask-text">{step.text}</p>
        {step.secret && typeof value === 'string' ? (
          <div className="k-ask-value">
            <ValueField value={value} secret wrap shown={hidden(value)} />
          </div>
        ) : (
          value !== null && (
            <p className="k-ask-plain">
              <Shown value={value} now={now} />
            </p>
          )
        )}
        {step.help && <p className="k-help">{step.help}</p>}
        {step.note && (
          <p className={`k-ask-note k-ask-note-${step.note.state}`}>
            {Icon && <Icon size={14} />}
            {step.note.text}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * "Waiting for <CRM>’s first notice" (row 71, images 09 and 10): what to ask the CRM's admin for,
 * a way to copy all of it, the numbered steps with their values, and how changes reach the website
 * until the first notice comes. The check step and the Inbox's window show it.
 */
export function AskFor({
  crm,
  steps,
  meanwhile,
  reach,
  now,
}: {
  crm: string;
  steps: ShownStep[];
  meanwhile: string;
  /** What changes reach meanwhile: "the website", or the websites by name. */
  reach: string;
  now: Date;
}) {
  const address = steps.some((step) => isAddress(step.value)) ? ', address included' : '';
  return (
    <div className="k-ask">
      <div className="k-ask-head">
        <p className="k-ask-intro">
          Ask the {crm} admin to do this. “Copy instructions” copies {allSteps(steps.length)}
          {address}.
        </p>
        <CopyInstructions text={instructions(steps)} />
      </div>
      <ol className="k-ask-steps">
        {steps.map((step, index) => (
          <Step key={index} step={step} n={index + 1} now={now} />
        ))}
      </ol>
      <p className="k-ask-meanwhile">
        Until it comes, changes reach {reach} {ended(meanwhile)}
      </p>
    </div>
  );
}
