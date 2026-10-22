// Manual sync (design B2, images 13 to 37 and the redrawn 39 and 40): the window that chooses what
// Core does with the chosen records, and the banner that follows it until the websites are up to
// date. Core keeps no record of a sync: this tab keeps what Core answered when it started, for an
// hour, and asks with it how the sync is coming along. A fetch only reads from a CRM, through the
// CRM's own code; the CRM is named only as its code names itself.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  type PickedRecord,
  type SyncChoice,
  type SyncStarted,
  type SyncView,
  type SyncWhat,
} from './api';
import { useShell } from './Shell';
import { failureWords } from './failure';
import { AlertTriangleIcon, CircleCheckIcon, LoaderIcon, RefreshIcon, SendIcon } from './icons';
import { Modal } from './ui';
import { capital, clock, counted, listed } from './time';
import { records } from './records';

type Datatype = PickedRecord['datatype'];

const PLURALS: Record<Datatype, string> = {
  property: 'properties',
  project: 'projects',
  agent: 'agents',
  office: 'offices',
  area: 'areas',
  association: 'associations',
};

/** "properties", "agents and offices". */
export const pluralOf = (types: Datatype[]): string =>
  listed(types.map((datatype) => PLURALS[datatype]));

/** "3 agents", "1 property and 2 agents", or "4 records" when the types are mixed beyond that. */
export function countedTypes(types: Datatype[]): string {
  const order: Datatype[] = ['property', 'project', 'agent', 'office', 'area', 'association'];
  return listed(
    order.flatMap((datatype) => {
      const n = types.filter((one) => one === datatype).length;
      return n === 0 ? [] : [records(n, datatype)];
    }),
  );
}

/** What is chosen, and what Core and the window need to say about it. */
export type SyncTarget = {
  /** The words after "Chosen:", before the count. */
  chosen: string;
  count: number;
  choice: SyncChoice;
  /** What a fetch does: ask again for the named records, or have the CRM list them afresh. */
  fetch:
    | { kind: 'records'; names: string[]; types: Datatype[] }
    | { kind: 'list'; tenants: string[]; types: Datatype[]; everyConnection: boolean };
  /** "the CRM", or "the CRMs" when the records come from several; never a CRM's name. */
  crm: string;
  /** The connections a fetch goes through, by their names. */
  connections: string[];
  /** The websites of the chosen tenants that are switched on. */
  sites: string[];
  /** Whether the choice reaches every tenant. */
  everyTenant: boolean;
  /** The chosen tenants that are switched off. */
  off: string[];
  rules: string;
  /** Where the sync is followed: the records page, a tenant's page or a record's page. */
  place: string;
};

/** A sync this tab started, as it keeps it. */
export type Kept = {
  started: SyncStarted;
  target: Omit<SyncTarget, 'choice'>;
  keptAt: number;
  /** When this tab first saw it done. */
  doneAt: string | null;
};

const KEPT_MS = 60 * 60_000;
const key = (place: string): string => `kowboy-core-panel:sync:${place}`;

function readKept(place: string): Kept | null {
  try {
    const kept = JSON.parse(sessionStorage.getItem(key(place)) ?? 'null') as Kept | null;
    return kept && Date.now() - kept.keptAt < KEPT_MS ? kept : null;
  } catch {
    return null;
  }
}

function writeKept(place: string, kept: Kept | null): void {
  try {
    if (kept) sessionStorage.setItem(key(place), JSON.stringify(kept));
    else sessionStorage.removeItem(key(place));
  } catch {
    // A tab that keeps nothing shows the banner until the page is left.
  }
}

// ---- Words ------------------------------------------------------------------------------------------

/** "ljungstrommakleri.se", "a.se and b.se", or "the websites" past two. */
/** A website's address is written as it is, also first in a sentence: "ljungstrommakleri.se keeps…". */
function sitesWords(sites: string[], capitalised = false): string {
  if (sites.length > 0 && sites.length <= 2) return listed(sites);
  return capitalised ? 'The websites' : 'the websites';
}

const one = (sites: string[]): boolean => sites.length === 1;

/** The connection's name, or "all 8 connections". */
function throughWords(target: Omit<SyncTarget, 'choice'>): string {
  if (target.fetch.kind === 'list' && target.fetch.everyConnection && target.connections.length > 1)
    return `all ${String(target.connections.length)} connections`;
  return listed(target.connections);
}

/** What the CRM lists afresh: "everything", "all of Ekdahl Fastighetsbyrå’s properties". */
function listedWhat(fetch: Extract<SyncTarget['fetch'], { kind: 'list' }>): string {
  if (fetch.types.length === 0) return 'everything';
  const what = pluralOf(fetch.types);
  if (fetch.tenants.length === 0) return `all ${what}`;
  return `all of ${listed(fetch.tenants.map((tenant) => `${tenant}’s`))} ${what}`;
}

function fetchText(target: SyncTarget): string {
  const { crm } = target;
  const fetch = target.fetch;
  if (fetch.kind === 'records') {
    return target.count === 1
      ? `Core asks ${crm} again for this record. If ${crm} no longer has it, it is removed.`
      : `Core asks ${crm} again for these ${String(target.count)} records. Any that ${crm} no longer has are removed.`;
  }
  const through = throughWords(target);
  if (fetch.types.length === 0) {
    return `${capital(crm)} lists ${listedWhat(fetch)} afresh through ${through}, and Core fetches it all in full. What hasn’t changed stays as it is; whatever ${crm} no longer lists is removed.`;
  }
  if (fetch.types.length === 1) {
    const plural = pluralOf(fetch.types);
    return `${capital(crm)} lists ${listedWhat(fetch)} afresh through ${through}, and Core fetches them in full, new ones too. ${capital(plural)} that haven’t changed stay as they are; those ${crm} no longer lists are removed.`;
  }
  return `${capital(crm)} lists ${listedWhat(fetch)} afresh through ${through}, and Core fetches them in full. Those that haven’t changed stay as they are; any ${crm} no longer lists are removed.`;
}

/** The first line of a sync under way. */
function startedText(kept: Kept): string {
  const { target, started } = kept;
  if (started.what === 'recompute')
    return `Recompute runs in the background with the current rules (version ${target.rules}).`;
  const through = throughWords(target);
  if (target.fetch.kind === 'records') {
    const names =
      target.fetch.names.length === target.count
        ? listed(target.fetch.names)
        : countedTypes(target.fetch.types);
    return `Asking ${target.crm} again for ${names} through ${through}; the recompute follows in the background.`;
  }
  return `${capital(target.crm)} lists ${listedWhat(target.fetch)} afresh through ${through}; the recompute follows in the background.`;
}

/** "Hjortronet Fastighetsbyrå and Norrsken Mäkleri are switched off: …". */
function offText(off: string[], what: SyncWhat): string | null {
  if (off.length === 0) return null;
  const then = what === 'recompute' ? 'the new text' : 'the changes';
  return `${listed(off)} ${off.length === 1 ? 'is' : 'are'} switched off: Core doesn’t tell ${off.length === 1 ? 'its' : 'their'} websites, and the websites can’t fetch. If ${off.length === 1 ? 'it is' : 'they are'} switched on again, ${off.length === 1 ? 'its' : 'their'} websites get ${then} then.`;
}

/** "Kopparbergsvägen 8", "a, b and 3 more". */
function namedList(named: { name: string }[], total: number): string {
  const names = named.map((record) => record.name);
  return total > names.length
    ? `${names.join(', ')} and ${String(total - names.length)} more`
    : listed(names);
}

function fetchedText(view: SyncView, kept: Kept): string[] {
  const fetched = view.fetched;
  if (!fetched) return [];
  const { crm } = kept.target;
  const it = (n: number) => (n === 1 ? 'it' : 'them');
  const typed = (named: { datatype: Datatype }[], total: number) =>
    named.length === total
      ? countedTypes(named.map((record) => record.datatype))
      : counted(total, 'record', 'records');
  const said: string[] = [];
  if (fetched.asked !== null) {
    if (fetched.removedCount > 0)
      said.push(
        `${capital(crm)} no longer has ${namedList(fetched.removed, fetched.removedCount)}, so Core removed ${it(fetched.removedCount)}.`,
      );
    if (fetched.addedCount > 0)
      said.push(
        `${capital(crm)} has ${namedList(fetched.added, fetched.addedCount)} again, so Core fetched ${it(fetched.addedCount)}.`,
      );
    const kept_ = fetched.asked - fetched.removedCount - fetched.addedCount;
    if (kept_ > 0) {
      const asked =
        kept.target.fetch.kind === 'records' && kept.target.fetch.names.length === 1
          ? (kept.target.fetch.names[0] ?? '')
          : kept.target.fetch.kind === 'records'
            ? countedTypes(kept.target.fetch.types)
            : counted(fetched.asked, 'record', 'records');
      const how =
        fetched.changed === 0
          ? 'nothing had changed'
          : fetched.changed >= kept_
            ? `${kept_ === 1 ? 'it' : `all ${String(kept_)}`} had changed`
            : `${String(fetched.changed)} had changed, the others hadn’t`;
      said.push(`Asked ${crm} again for ${asked} through ${throughWords(kept.target)}: ${how}.`);
    }
    return said;
  }
  if (fetched.addedCount > 0)
    said.push(
      `${capital(crm)} listed ${typed(fetched.added, fetched.addedCount)} Core didn’t have, and Core fetched ${it(fetched.addedCount)}: ${namedList(fetched.added, fetched.addedCount)}.`,
    );
  if (fetched.removedCount > 0)
    said.push(
      `${capital(crm)} no longer lists ${typed(fetched.removed, fetched.removedCount)}, so Core removed ${it(fetched.removedCount)}: ${namedList(fetched.removed, fetched.removedCount)}.`,
    );
  else if (fetched.addedCount > 0) said.push('Nothing was removed.');
  if (fetched.changed > 0)
    said.push(`${capital(counted(fetched.changed, 'record', 'records'))} had changed.`);
  if (said.length === 0) said.push(`${capital(crm)} lists what Core had, and nothing had changed.`);
  return said;
}

function recomputedText(view: SyncView, kept: Kept): string[] {
  const done = view.recomputed;
  if (!done) return [];
  const fetch = kept.target.fetch;
  const types = fetch.types;
  const examined =
    types.length === 1 && types[0]
      ? records(done.examined, types[0])
      : counted(done.examined, 'record', 'records');
  return [
    `Recompute done with rules version ${kept.target.rules}: ${examined} examined, ${String(done.changed)} changed, ${String(done.unchanged)} unchanged, ${done.failed === 0 ? 'none' : String(done.failed)} failed.`,
  ];
}

const sentText = (kept: Kept, sites: string[]): string =>
  `Sent ${counted(kept.started.sent ?? 0, 'record', 'records')} to ${sitesWords(sites)} exactly as Core has them.`;

/** The latest a website fetched: what "confirmed 10:27" says. */
const confirmed = (view: SyncView): string | null =>
  view.sites
    .map((site) => site.fetchedAt ?? '')
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

type Shown = {
  tone: 'info' | 'done' | 'warn';
  title: string;
  lines: string[];
  progress: { done: number; total: number } | null;
};

/** What the banner says of a sync, from what Core answered. */
export function shown(kept: Kept, view: SyncView | null, removedHint: boolean): Shown {
  const what = kept.started.what;
  const startedAt = clock(kept.started.at);
  const active = view
    ? [...new Set(view.sites.filter((site) => site.tenant.active).map((site) => site.label))]
    : kept.target.sites;
  const off = view
    ? [...new Set(view.sites.filter((site) => !site.tenant.active).map((site) => site.tenant.name))]
    : kept.target.off;
  const offLine = offText(off, what);
  const get = `${sitesWords(kept.target.everyTenant ? [] : active, true)} ${one(active) && !kept.target.everyTenant ? 'gets' : 'get'} each change as soon as Core writes it.`;
  const lines = (all: (string | null | undefined)[]): string[] =>
    all.filter((line): line is string => typeof line === 'string' && line !== '');

  if (!view || view.state === 'working') {
    if (what === 'send') {
      return {
        tone: 'info',
        title: `Waiting for ${sitesWords(active)} (${startedAt})`,
        lines: [sentText(kept, active)],
        progress: null,
      };
    }
    const queued =
      view && view.waiting > 0
        ? `${capital(counted(view.waiting, 'record', 'records'))} still to fetch from ${kept.target.crm}.`
        : null;
    return {
      tone: 'info',
      title: `Sync started (${startedAt})`,
      lines: lines([startedText(kept), queued, get, offLine]),
      progress: what === 'recompute' ? (view?.progress ?? null) : null,
    };
  }

  const at = clock(view.writtenAt ?? kept.doneAt ?? kept.started.at);
  if (view.state === 'stopped') {
    return {
      tone: 'warn',
      title: `Sync stopped (${at})`,
      lines: [
        view.error
          ? `Core couldn’t finish the sync, and the error said “${view.error}”. Try again in a while, and if it fails again, pass these words on to Core’s developers.`
          : 'Core no longer knows this sync. Start it again if it is still needed.',
      ],
      progress: null,
    };
  }

  const outcome =
    what === 'fetch'
      ? fetchedText(view, kept)
      : what === 'recompute'
        ? recomputedText(view, kept)
        : [sentText(kept, active)];
  const failedFetches =
    view.failedFetches > 0
      ? `${capital(counted(view.failedFetches, 'record', 'records'))} couldn’t be fetched from ${kept.target.crm} yet. Core tries again by itself, and the Inbox shows any it gives up on.`
      : null;
  const behind = view.sites.filter((site) => site.tenant.active && !site.current);
  if (behind.length > 0) {
    const labels = [...new Set(behind.map((site) => site.label))];
    return {
      tone: 'info',
      title: `Waiting for ${sitesWords(labels)} (${at})`,
      lines: lines([
        ...outcome,
        failedFetches,
        `Waiting for ${one(labels) ? 'the website' : 'the websites'} to fetch ${what === 'send' ? 'them' : 'the changes'}. Websites usually fetch within seconds; one that hasn’t fetched within an hour shows up in the Inbox.`,
        offLine,
      ]),
      progress: null,
    };
  }
  const last = confirmed(view);
  const upToDate =
    active.length === 0
      ? null
      : view.writtenAt === null && what !== 'send'
        ? `Nothing changed, so ${sitesWords(active)} had nothing new to fetch.`
        : `${off.length > 0 ? 'The other tenants’ websites are' : `${sitesWords(active, true)} ${one(active) ? 'is' : 'are'}`} up to date${last ? ` (confirmed ${clock(last)})` : ''}.`;
  const hint =
    removedHint && (view.fetched?.removedCount ?? 0) > 0
      ? 'Removed records are left out of the list. To see them, switch on Include removed records.'
      : null;
  return {
    tone: 'done',
    title: what === 'send' ? `Sent (${at})` : `Sync done (${at})`,
    lines: lines([...outcome, failedFetches, upToDate, offLine, hint]),
    progress: null,
  };
}

// ---- Following a sync -------------------------------------------------------------------------------

const EVERY_MS = 2_000;

/** Whether nothing more will change: stopped, or done with every website up to date. */
const finished = (view: SyncView | null): boolean =>
  view !== null &&
  (view.state === 'stopped' ||
    (view.state === 'done' && view.sites.every((site) => !site.tenant.active || site.current)));

/** The sync this tab follows at a place, read again every two seconds until it is finished. */
export function useSync(place: string, onFinished?: () => void) {
  const { away } = useShell();
  const [kept, setKept] = useState<Kept | null>(() => readKept(place));
  const [view, setView] = useState<SyncView | null>(null);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const start = useCallback(
    (next: Kept) => {
      writeKept(place, next);
      setView(null);
      setKept(next);
    },
    [place],
  );

  useEffect(() => {
    if (!kept) return undefined;
    let current = kept;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      api.syncState(current.started).then(
        (next) => {
          if (stopped) return;
          setView(next);
          if (next.state !== 'working' && current.doneAt === null) {
            current = { ...current, doneAt: new Date().toISOString() };
            writeKept(place, current);
          }
          if (finished(next)) {
            finishedRef.current?.();
            return;
          }
          timer = setTimeout(read, EVERY_MS);
        },
        (error: unknown) => {
          if (stopped || away(error)) return;
          timer = setTimeout(read, EVERY_MS * 2);
        },
      );
    };
    read();
    const expiry = setTimeout(
      () => setKept(null),
      Math.max(0, KEPT_MS - (Date.now() - kept.keptAt)),
    );
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      clearTimeout(expiry);
    };
  }, [kept, place, away]);

  /** A finished sync's banner goes when the person moves on, as a filter change does (B2, 16). */
  const forgetFinished = () => {
    if (!finished(view)) return;
    writeKept(place, null);
    setKept(null);
    setView(null);
  };

  return { kept, view, start, forgetFinished };
}

export function SyncBanner({
  kept,
  view,
  removedHint = false,
}: {
  kept: Kept | null;
  view: SyncView | null;
  /** The list leaves removed records out, so a removal says how to see them. */
  removedHint?: boolean;
}) {
  if (!kept) return null;
  const banner = shown(kept, view, removedHint);
  return (
    <section
      className={`k-banner k-banner-${banner.tone} k-sync-banner`}
      aria-label="Sync"
      aria-live="polite"
    >
      {banner.tone === 'info' ? (
        <LoaderIcon className="k-spin" size={20} />
      ) : banner.tone === 'warn' ? (
        <AlertTriangleIcon size={20} />
      ) : (
        <CircleCheckIcon size={20} />
      )}
      <div className="k-grow">
        <p className="k-banner-title">{banner.title}</p>
        {banner.lines.map((line) => (
          <p key={line} className="k-banner-text k-banner-line">
            {line}
          </p>
        ))}
        {banner.progress && (
          <div className="k-progress-block">
            <p className="k-progress-words">
              Recompute: {banner.progress.done} of {banner.progress.total} records
            </p>
            <div
              className="k-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={banner.progress.total}
              aria-valuenow={banner.progress.done}
            >
              <span
                style={{
                  width: `${String(
                    banner.progress.total === 0
                      ? 0
                      : Math.round((banner.progress.done / banner.progress.total) * 100),
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ---- The window -------------------------------------------------------------------------------------

/** How many records a recompute takes before the window says it runs in the background. */
const LONG = 100;

export function SyncWindow({
  target,
  onClose,
  onStarted,
}: {
  target: SyncTarget;
  onClose: () => void;
  onStarted: (kept: Kept) => void;
}) {
  const { away } = useShell();
  const [what, setWhat] = useState<SyncWhat>('fetch');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const many = target.count !== 1;
  const sites = target.everyTenant ? [] : target.sites;
  const options: { what: SyncWhat; title: string; text: string }[] = [
    {
      what: 'fetch',
      title: `Fetch from ${target.crm} → recompute → send`,
      text: fetchText(target),
    },
    {
      what: 'recompute',
      title: 'Recompute → send',
      text: `No call to ${target.crm}. Core prepares the website text again from what it already holds, with the current rules (version ${target.rules}).${target.count > LONG ? ' Runs in the background; you see its progress here.' : ''}`,
    },
    {
      what: 'send',
      title: 'Send',
      text: `The ${many ? 'records go' : 'record goes'} to ${sitesWords(sites)} again exactly as ${many ? 'they are' : 'it is'}. Nothing is fetched or recomputed.`,
    },
  ];
  const meanwhile =
    sites.length === 0
      ? 'Websites keep showing their copy meanwhile and get each change as soon as Core writes it.'
      : `${sitesWords(sites, true)} ${one(sites) ? 'keeps' : 'keep'} showing ${one(sites) ? 'its' : 'their'} copy meanwhile and ${one(sites) ? 'gets' : 'get'} each change as soon as Core writes it.`;
  const records_ = counted(target.count, 'record', 'records');
  const go = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const started = await api.sync(what, target.choice);
      const { choice: _choice, ...rest } = target;
      onStarted({ started, target: rest, keptAt: Date.now(), doneAt: null });
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Sync ${records_}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="k-button k-button-primary"
            disabled={busy || target.count === 0}
            onClick={() => void go()}
          >
            {busy ? (
              <LoaderIcon className="k-spin" size={18} />
            ) : what === 'send' ? (
              <SendIcon size={18} />
            ) : (
              <RefreshIcon size={18} />
            )}
            {what === 'fetch'
              ? `Fetch from ${target.crm}`
              : what === 'recompute'
                ? `Recompute ${records_}`
                : `Send ${records_}`}
          </button>
        </>
      }
    >
      <p className="k-chosen">
        <span className="k-muted">Chosen: </span>
        {target.chosen} · <strong>{records_}</strong>
      </p>
      <p className="k-label k-sync-label" id="sync-what">
        What Core does
      </p>
      <div className="k-sync-options" role="radiogroup" aria-labelledby="sync-what">
        {options.map((option) => {
          const on = option.what === what;
          return (
            <button
              key={option.what}
              type="button"
              role="radio"
              aria-checked={on}
              className={`k-sync-option${on ? ' k-sync-option-on' : ''}`}
              onClick={() => setWhat(option.what)}
            >
              <span className={`k-radio${on ? ' k-radio-on' : ''}`} aria-hidden="true" />
              <span>
                <span className="k-sync-option-title">{option.title}</span>
                <span className="k-sync-option-text">{option.text}</span>
              </span>
            </button>
          );
        })}
      </div>
      {what !== 'send' && <p className="k-help k-sync-meanwhile">{meanwhile}</p>}
      {failed && <p className="k-error">{failed}</p>}
    </Modal>
  );
}
