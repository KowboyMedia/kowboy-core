// The Inbox (design B, images 05, 13 to 16, 19 to 22 and 43 to 45, and the tenant mockups, image
// 26): Core's state, then what needs you, urgent first and then oldest first; what waits after
// someone acted, and the CRM connections still waiting for their CRM's first notice, each with what
// to ask the CRM's admin for; and what was fixed today. The page reads again
// by itself, so a problem that is put right moves to "Fixed today". Each card's button opens its
// window: fix a website's bell secret; "Enter new login" opens the connection's
// own screen; "Retry 3 properties" has the CRM fetch them again at once; "Open <tenant>" opens the
// tenant's page.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  api,
  type Card,
  type CheckCard,
  type FailingRecord,
  type Fixed,
  type FormsCard,
  type Inbox,
  type Level,
  type LoginCard,
  type RecordsCard,
  type SetupCard,
  type SiteCard,
  type Tenant,
  type WorkerCard,
} from './api';
import { Shell, useShell } from './Shell';
import {
  ago,
  ahead,
  capital,
  clock,
  counted,
  listed,
  onDay,
  sameDay,
  sentWhen,
  when,
} from './time';
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleCheckIcon,
  CopyIcon,
  KeyIcon,
  ListIcon,
  LoaderIcon,
  PencilIcon,
  RefreshIcon,
} from './icons';
import { failureWords } from './failure';
import { Modal, useNote, ValueField } from './ui';
import { isPlatform, platformWords } from './websites';
import { recordPath } from './records';
import { owning, shortName } from './connect';
import { AskFor, ended, reachWords } from './progress';

const EVERY_MS = 30_000;

const LEVELS: Record<Level, { words: string; colour: string }> = {
  P0: { words: 'Down', colour: 'red' },
  P1: { words: 'Urgent', colour: 'red' },
  P2: { words: 'Needs a look', colour: 'orange' },
};

/** What a card's buttons open. */
type Open = { kind: 'bell'; card: SiteCard } | { kind: 'ask'; card: SetupCard } | null;

type Opener = (open: Open) => void;

/** A records card whose records someone just had fetched again. */
type Retried = (card: RecordsCard) => void;

function OpenBrokerage({ tenant }: { tenant: Tenant }) {
  return (
    <Link className="k-button k-button-link" to={`/brokerages/${String(tenant.id)}`}>
      Open {tenant.name}
    </Link>
  );
}

function Frame({
  card,
  who,
  now,
  title,
  children,
  actions,
}: {
  card: Card;
  who: string;
  now: Date;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const waiting = card.acted !== null;
  const level = waiting ? { words: 'Waiting', colour: 'blue' } : LEVELS[card.level];
  return (
    <article className={`k-card k-card-${waiting ? 'wait' : card.level}`}>
      <div className="k-card-head">
        <span className={`k-pill k-pill-${level.colour}`}>{level.words}</span>
        <span className="k-card-who">
          {who}
          {card.since && ` · since ${when(card.since, now)}`}
        </span>
      </div>
      <h3 className="k-card-title">{title}</h3>
      {children}
      {actions && <div className="k-card-actions">{actions}</div>}
    </article>
  );
}

/** "Sent from granstedtbostad.se last night, when the CRM didn’t answer." */
function sentSentence(card: FormsCard, now: Date): string {
  const crm = listed(card.crms, 'or') || 'the CRM';
  const times = [...new Set(card.sentAt.map((at) => sentWhen(at, now)))];
  const from = card.sites.length > 0 ? ` from ${listed(card.sites)}` : '';
  const them = card.count === 1 ? 'it' : 'them';
  const cause =
    card.refused === 0
      ? `, when ${crm} didn’t answer`
      : card.unanswered === 0
        ? `; ${crm} refused ${them}`
        : `; ${crm} didn’t answer or refused ${them}`;
  return `Sent${from} ${listed(times)}${cause}.`;
}

function Forms({ card, now }: { card: FormsCard; now: Date }) {
  const again = card.answeredAgainAt
    ? ` ${card.crms.length > 1 ? 'They have' : 'It has'} answered again since ${when(card.answeredAgainAt, now)}.`
    : '';
  return (
    <Frame
      card={card}
      who={card.tenant.name}
      now={now}
      title={`${counted(card.count, 'visitor form', 'visitor forms')} didn’t reach ${listed(card.crms) || 'the CRM'}`}
      actions={<OpenBrokerage tenant={card.tenant} />}
    >
      <p className="k-card-body">
        {sentSentence(card, now)}
        {again}
      </p>
    </Frame>
  );
}

function Login({ card, now }: { card: LoginCard; now: Date }) {
  const navigate = useNavigate();
  const tenant = card.tenant;
  // The connection's own screen, the one its Edit icon opens, coming back here when saved.
  const enter = () => {
    if (!tenant) return;
    navigate(
      `/brokerages/${String(tenant.id)}/connections/${encodeURIComponent(card.connectionId)}?from=inbox`,
    );
  };
  return (
    <Frame
      card={card}
      who={tenant?.name ?? card.crm}
      now={now}
      title={`${card.crm} refused the login`}
      actions={
        <>
          {tenant && (
            <button type="button" className="k-button k-button-primary" onClick={enter}>
              <PencilIcon />
              Enter new login
            </button>
          )}
          {tenant && <OpenBrokerage tenant={tenant} />}
        </>
      }
    >
      <p className="k-card-body">
        Changes are held back since then.{leavingWords(card, now)} Usually a changed password or an
        ended {card.crm} subscription.
      </p>
    </Frame>
  );
}

/**
 * " Tomorrow at 06:02 its 2 offices and their properties leave sjobrismakleri.se, unless fixed.",
 * or, once that time is past, " Since 06:02 its 2 offices and their properties are off …".
 */
function leavingWords(card: LoginCard, now: Date): string {
  if (!card.leaving) return '';
  const offices =
    card.leaving.offices === 1
      ? 'its office and its properties'
      : `its ${String(card.leaving.offices)} offices and their properties`;
  const sites = listed(card.sites) || 'its websites';
  return Date.parse(card.leaving.at) > now.getTime()
    ? ` ${capital(ahead(card.leaving.at, now))} ${offices} leave ${sites}, unless fixed.`
    : ` Since ${when(card.leaving.at, now)} ${offices} are off ${sites}.`;
}

/** Why a website stopped updating, from how it last answered Core's change notice. */
function siteCause(card: SiteCard, now: Date): string {
  const at = card.lastAnswerAt ? ` at ${when(card.lastAnswerAt, now)}` : '';
  // The website's own words, or why it gave none, quoted after the answer code.
  const said = card.lastAnswerSaid ? `: “${card.lastAnswerSaid}”` : '';
  const code = /^http (\d+)$/.exec(card.lastAnswer ?? '')?.[1];
  if (code === '401' || code === '403') {
    return `The website refuses Core’s change notices (it answered ${code}${at}${said}): its bell secret doesn’t match Core’s.`;
  }
  if (code === '404') {
    return `The website has nothing at the bell address Core sends change notices to (it answered 404${at}${said}): the part of the website that takes them may be switched off, or the website may have been added with a wrong bell address.`;
  }
  if (code) {
    return `The website answers Core’s change notices with an error (it answered ${code}${at}${said}). The fault is at the website, not in Core or a CRM: whoever runs the website finds the reason in its error log.`;
  }
  if (card.lastAnswer === 'failed') {
    return `The website doesn’t answer Core’s change notices (no answer${at}${said}): it is down or slow, or the bell address it was added with is wrong. Check that the website opens in a browser.`;
  }
  if (card.lastAnswer === 'ok') {
    return `The website takes Core’s change notices (the last${at}) but doesn’t fetch the changes: the tenant token it uses may not be Core’s. Compare it with the tenant token on the tenant’s page.`;
  }
  return 'Core can’t tell why from the website’s answers.';
}

function Site({ card, now, onOpen }: { card: SiteCard; now: Date; onOpen: Opener }) {
  const fetched = card.lastFetchAt
    ? `No update since ${when(card.lastFetchAt, now)}.`
    : 'It has never fetched an update.';
  return (
    <Frame
      card={card}
      who={card.tenant?.name ?? card.site}
      now={now}
      title={`${card.site} stopped updating`}
      actions={
        <>
          {card.bellSecret && (
            <button
              type="button"
              className="k-button k-button-primary"
              onClick={() => onOpen({ kind: 'bell', card })}
            >
              <KeyIcon />
              Fix bell secret
            </button>
          )}
          {card.tenant && <OpenBrokerage tenant={card.tenant} />}
        </>
      }
    >
      <p className="k-card-body">
        {fetched} {siteCause(card, now)} Visitors see properties that have since changed or gone.
      </p>
    </Frame>
  );
}

/** Each type's word, one and many, in the order the cards count them. */
const RECORD_WORDS: Record<FailingRecord['datatype'], [string, string]> = {
  property: ['property', 'properties'],
  project: ['project', 'projects'],
  agent: ['agent', 'agents'],
  office: ['office', 'offices'],
  area: ['area', 'areas'],
  association: ['association', 'associations'],
};

/** "3 properties", "2 properties and 1 agent". */
function recordsCounted(records: { datatype: FailingRecord['datatype'] }[]): string {
  return listed(
    (Object.keys(RECORD_WORDS) as FailingRecord['datatype'][]).flatMap((datatype) => {
      const n = records.filter((record) => record.datatype === datatype).length;
      const [one, many] = RECORD_WORDS[datatype];
      return n === 0 ? [] : [counted(n, one, many)];
    }),
  );
}

/** The record's key, as the card names it. */
const recordKey = (record: FailingRecord): string =>
  `${record.connection} ${record.datatype} ${record.id}`;

/** A record by its address or name; one Core never loaded by the CRM's id for it. */
const recordName = (record: FailingRecord, crm: string): string =>
  record.name ?? `The ${RECORD_WORDS[record.datatype][0]} with ${crm} id ${record.id}`;

/** "Until they load, lindqvistholm.se and nyproduktion.lindqvistholm.se miss these changes." */
function missedWords(card: RecordsCard): string | null {
  if (card.sites.length === 0) return null;
  const one = card.records.length === 1;
  return `Until ${one ? 'it loads' : 'they load'}, ${listed(card.sites)} ${card.sites.length === 1 ? 'misses' : 'miss'} these changes.`;
}

function Records({ card, now, onRetried }: { card: RecordsCard; now: Date; onRetried: Retried }) {
  const { away } = useShell();
  const note = useNote();
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      await api.retry(
        card.tenant.id,
        card.key,
        card.records.map(({ connection, datatype, id }) => ({ connection, datatype, id })),
      );
      onRetried(card);
    } catch (error) {
      if (!away(error)) note({ text: failureWords(error), icon: 'warn' });
    }
    setBusy(false);
  };
  const these = recordsCounted(card.records);
  const missed = missedWords(card);
  return (
    <Frame
      card={card}
      who={card.tenant.name}
      now={now}
      title={`${these} can’t be loaded from ${card.crm}`}
      actions={
        <>
          <button
            type="button"
            className="k-button k-button-primary"
            disabled={busy}
            onClick={() => void retry()}
          >
            {busy ? <LoaderIcon className="k-spin" /> : <RefreshIcon />}
            Retry {these}
          </button>
          <OpenBrokerage tenant={card.tenant} />
        </>
      }
    >
      {/* Each record with what the CRM's code says of it, so the card says why it failed. */}
      <ul className="k-card-records">
        {card.records.map((record) => (
          <li key={recordKey(record)}>
            {record.name !== null ? (
              <Link className="k-card-record" to={recordPath(record)}>
                {record.name}
              </Link>
            ) : (
              <span className="k-card-record">{recordName(record, card.crm)}</span>
            )}
            {record.note && <span className="k-card-note">{capital(record.note)}</span>}
          </li>
        ))}
      </ul>
      {missed && <p className="k-card-body">{missed}</p>}
    </Frame>
  );
}

const RESTART = 'node dist/main.js worker';

function CopyCommand() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(RESTART).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined,
    );
  };
  return (
    <div className="k-command">
      <code>{RESTART}</code>
      <button type="button" aria-label="Copy" onClick={copy}>
        {copied ? <CheckIcon size={20} /> : <CopyIcon size={20} />}
      </button>
    </div>
  );
}

function Worker({ card, crms, now }: { card: WorkerCard; crms: string[]; now: Date }) {
  const changes = crms.length > 0 ? `${listed(crms, 'or')} changes` : 'CRM changes';
  const reach = crms.length > 0 ? listed(crms) : 'the CRM';
  return (
    <Frame card={card} who="Core" now={now} title="The worker stopped">
      <p className="k-card-status">
        <span>
          Worker <span className="k-bad">stopped</span>
        </span>
        <span>
          Database <span className="k-good">OK</span>
        </span>
      </p>
      <p className="k-card-body" style={{ marginTop: 10 }}>
        Until it runs again, no {changes} reach the websites, and Core itself can’t send alerts —
        the alert you got comes from the outside check that watches Core. Websites still show their
        copy, and visitors’ forms still reach {reach}. Nothing is lost: once the worker runs, Core
        catches up by itself.
      </p>
      <p className="k-restart">Restart the worker where Core is hosted:</p>
      <CopyCommand />
      <p className="k-footnote">
        This needs access to Core’s host; if you don’t have it, pass this on to the developers. This
        page turns green once the worker runs.
      </p>
    </Frame>
  );
}

function Check({ card, now }: { card: CheckCard; now: Date }) {
  const who = card.tenants.map((tenant) => tenant.name).join(', ') || card.about || 'Core';
  return (
    <Frame
      card={card}
      who={who}
      now={now}
      title={card.title}
      actions={
        card.tenants.length > 0 ? (
          <>
            {card.tenants.map((tenant) => (
              <OpenBrokerage key={tenant.id} tenant={tenant} />
            ))}
          </>
        ) : undefined
      }
    >
      {card.names.length > 0 && (
        <ul className="k-card-names">
          {card.names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

function OneCard({
  card,
  inbox,
  now,
  onOpen,
  onRetried,
}: {
  card: Card;
  inbox: Inbox;
  now: Date;
  onOpen: Opener;
  onRetried: Retried;
}) {
  switch (card.kind) {
    case 'worker':
      return <Worker card={card} crms={inbox.crms} now={now} />;
    case 'forms':
      return <Forms card={card} now={now} />;
    case 'login':
      return <Login card={card} now={now} />;
    case 'site':
      return <Site card={card} now={now} onOpen={onOpen} />;
    case 'check':
      return <Check card={card} now={now} />;
    case 'records':
      return <Records card={card} now={now} onRetried={onRetried} />;
  }
}

// ---- Waiting and Fixed today ----------------------------------------------------------------------

/** A card someone acted on (image 14): what they did, and what happens next by itself. */
function WaitingCard({ card, now }: { card: Card; now: Date }) {
  const { me } = useShell();
  const by = card.acted?.by === me?.email ? 'You' : (card.acted?.by ?? 'Someone');
  const who =
    card.kind === 'forms' || card.kind === 'records'
      ? card.tenant.name
      : card.kind === 'check'
        ? card.tenants.map((tenant) => tenant.name).join(', ') || card.about || 'Core'
        : card.kind === 'worker'
          ? 'Core'
          : (card.tenant?.name ?? (card.kind === 'site' ? card.site : card.crm));
  const title =
    card.kind === 'site'
      ? `${card.site} stopped updating`
      : card.kind === 'check'
        ? card.title
        : card.kind === 'login'
          ? `${card.crm} refused the login`
          : card.kind === 'forms'
            ? `${counted(card.count, 'visitor form', 'visitor forms')} didn’t reach ${listed(card.crms) || 'the CRM'}`
            : card.kind === 'records'
              ? `${recordsCounted(card.records)} can’t be loaded from ${card.crm}`
              : 'The worker stopped';
  const words =
    card.kind === 'site'
      ? `${by} pasted the bell secret. Waiting for the website’s next sync — within 15 minutes. This card moves to “Fixed today” by itself, or back to “Needs you” if the website still refuses.`
      : card.kind === 'records'
        ? retriedWords(card, by)
        : `${by} marked this as done at ${when(card.acted?.at ?? '', now)}. This card moves to “Fixed today” by itself, or back to “Needs you” if it comes back.`;
  return (
    <Frame card={card} who={who} now={now} title={title}>
      <p className="k-card-waiting">
        <LoaderIcon className="k-spin" size={18} />
        <span>{words}</span>
      </p>
    </Frame>
  );
}

/** What a waiting records card says: who had them fetched again, and what happens next. */
function retriedWords(card: RecordsCard, by: string): string {
  const one = card.records.length === 1;
  const them = one ? 'it' : 'them';
  return `${by} had ${card.crm} fetch ${one ? (card.records[0]?.name ?? `the ${RECORD_WORDS[card.records[0]?.datatype ?? 'property'][0]}`) : `the ${recordsCounted(card.records)}`} again. Waiting for ${them} to load. This card moves to “Fixed today” by itself, or back to “Needs you” if Core gives up on ${one ? 'it' : 'one of them'} again.`;
}

/**
 * A CRM connection still being set up (row 41, images 14, 16 and 22): its CRM has sent Core no
 * notice yet. It waits here until the first one comes, with what to ask the CRM's admin for.
 */
function Setup({ card, now, onOpen }: { card: SetupCard; now: Date; onOpen: Opener }) {
  const sites = listed(card.sites) || 'its websites';
  const test = card.formsTestMode;
  return (
    <article className="k-card k-card-wait">
      <div className="k-card-head">
        <span className="k-pill k-pill-blue">Setting up</span>
        <span className="k-card-who">
          {card.tenant.name} · set up {onDay(card.since, now)}
        </span>
      </div>
      <h3 className="k-card-title">Waiting for {owning(card.crm)} first notice</h3>
      <p className="k-card-body">
        {owning(shortName(card.tenant.name))} {card.crm} admin has to send {owning(card.crm)}{' '}
        notices to Core. Until the first one comes, changes reach {sites} {ended(card.meanwhile)}
      </p>
      {test && (
        <p className="k-warning k-card-warning">
          <AlertTriangleIcon size={18} />
          <span>
            Forms test mode is on{test.since ? ` (since ${when(test.since, now)})` : ''}: forms from{' '}
            {sites} don’t reach {card.crm}.
          </span>
        </p>
      )}
      <div className="k-card-actions">
        <button
          type="button"
          className="k-button k-button-quiet"
          onClick={() => onOpen({ kind: 'ask', card })}
        >
          <ListIcon />
          See what to ask for
        </button>
        <OpenBrokerage tenant={card.tenant} />
      </div>
    </article>
  );
}

/** "All 3 properties loaded", "Both properties loaded", "Ringvägen 52 loaded". */
function loadedWords(counts: Record<string, number>, name: string | null): string {
  const records = Object.entries(counts).flatMap(([datatype, n]) =>
    Array.from({ length: n }, () => ({ datatype: datatype as FailingRecord['datatype'] })),
  );
  const total = records.length;
  if (total === 1 && name) return `${name} loaded`;
  if (total === 1) return `${capital(recordsCounted(records).replace(/^1 /, 'the '))} loaded`;
  const words = recordsCounted(records);
  if (total === 2 && Object.keys(counts).length === 1)
    return `Both ${words.replace(/^2 /, '')} loaded`;
  return `All ${words} loaded`;
}

/** "2 forms delivered to <CRM>", "New login works", "Website up to date again". */
function fixedWords(fixed: Fixed): string {
  const facts = fixed.facts;
  switch (facts.kind) {
    case 'forms': {
      const crm = listed(facts.crms) || 'the CRM';
      return facts.delivered === facts.total
        ? `${counted(facts.delivered, 'form', 'forms')} delivered to ${crm}`
        : `${String(facts.delivered)} of ${counted(facts.total, 'form', 'forms')} delivered to ${crm}`;
    }
    case 'login':
      return facts.saved ? 'New login works' : `${facts.crm} accepts the login again`;
    case 'records':
      return loadedWords(facts.counts, facts.name);
    case 'site':
      return 'Website up to date again';
    case 'check':
      return `Solved: ${facts.title}`;
    case 'worker':
      return 'The worker runs again';
  }
}

function FixedToday({ fixed, now }: { fixed: Fixed[]; now: Date }) {
  const today = fixed.filter((one) => sameDay(one.solvedAt, now));
  if (today.length === 0) return null;
  return (
    <>
      <div className="k-section k-section-quiet">
        <h2>Fixed today</h2>
      </div>
      <ul className="k-fixed">
        {today.map((one) => (
          <li key={`${one.key} ${one.solvedAt}`}>
            <CircleCheckIcon size={20} />
            <span className="k-fixed-text">
              <strong>
                {one.tenants.map((tenant) => tenant.name).join(', ') || one.about || 'Core'}
              </strong>{' '}
              · {fixedWords(one)}
            </span>
            <span className="k-fixed-time">{clock(one.solvedAt)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- Core's state ----------------------------------------------------------------------------------

function Strip() {
  return (
    <section className="k-strip" aria-label="Core">
      <div className="k-strip-state">
        <span className="k-pill k-pill-green">Core running</span>
        Worker and database OK
      </div>
    </section>
  );
}

// ---- The cards' windows ---------------------------------------------------------------------------

/** "Fix bell secret · ekdahlfastighet.se" (image 13). */
function BellSecretWindow({
  card,
  now,
  onClose,
  onDone,
}: {
  card: SiteCard;
  now: Date;
  onClose: () => void;
  onDone: () => void;
}) {
  const { away } = useShell();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const platform = isPlatform(card.platform) ? platformWords(card.platform) : null;
  const code = /^http (\d+)$/.exec(card.lastAnswer ?? '')?.[1] ?? '';
  const done = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await api.acted(card.key);
      onDone();
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Fix bell secret · ${card.site}`}
      tone="danger"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="k-button k-button-primary"
            disabled={busy}
            onClick={() => void done()}
          >
            {busy ? <LoaderIcon className="k-spin" size={18} /> : <CheckIcon size={18} />}
            Done, I’ve pasted it
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        {card.lastFetchAt
          ? `No update since ${when(card.lastFetchAt, now)}. `
          : 'It has never fetched an update. '}
        {card.lastAnswerAt ? `At ${when(card.lastAnswerAt, now)} ` : ''}
        {card.site} refused Core’s bell (it answered <strong>{code}</strong>): the bell secret saved
        in {platform ? platform.editIn : 'the website'} isn’t the one Core uses.
      </p>
      <p className="k-bell-step">
        {platform
          ? `Copy Core’s bell secret into ${platform.bell}, and save.`
          : 'Copy Core’s bell secret into the website’s settings as its bell secret, and save.'}
      </p>
      <div className="k-paste">
        <span className="k-label">Bell secret</span>
        <ValueField value={card.bellSecret ?? ''} secret />
      </div>
      <p className="k-help">
        The website then syncs within 15 minutes, and this card moves to “Fixed today” by itself.
      </p>
      {failed && <p className="k-error">{failed}</p>}
    </Modal>
  );
}

/** "See what to ask for" (row 71): the steps for the CRM's admin, as the check step shows them. */
function AskWindow({ card, now, onClose }: { card: SetupCard; now: Date; onClose: () => void }) {
  return (
    <Modal
      title={`Waiting for ${owning(card.crm)} first notice · ${card.tenant.name}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Close
          </button>
          <OpenBrokerage tenant={card.tenant} />
        </>
      }
    >
      <AskFor
        crm={card.crm}
        steps={card.steps}
        meanwhile={card.meanwhile}
        reach={reachWords(card.sites, true)}
        now={now}
      />
    </Modal>
  );
}

// ---- The page -------------------------------------------------------------------------------------

function DownBanner({ inbox, now }: { inbox: Inbox; now: Date }) {
  const seen = inbox.worker.lastSeenAt;
  return (
    <section className="k-down" role="alert">
      <AlertTriangleIcon size={24} />
      <div>
        <p className="k-down-title">Core is down for all customers</p>
        <p className="k-down-text">
          {seen
            ? `The worker hasn’t checked in since ${when(seen, now)} (${ago(seen, now)}).`
            : 'The worker has never checked in.'}
        </p>
      </div>
    </section>
  );
}

function Empty() {
  return (
    <section className="k-empty">
      <CircleCheckIcon size={50} strokeWidth={1.3} />
      <h2>Nothing needs you</h2>
      <p>Every tenant, CRM connection and website is working.</p>
    </section>
  );
}

/** What one press asked for: the records, and when the card's problem began to wait. */
type Pending = { keys: Set<string>; card: RecordsCard; actedAt: string | null };

/** Whether a record is still named, then where the card is: under Waiting, back, or gone. */
function pendingNow(entry: Pending, key: string, inbox: Inbox): 'wait' | 'back' | 'loaded' {
  const waiting = inbox.waiting.find((one) => one.key === key);
  if (waiting?.kind === 'records') {
    entry.actedAt ??= waiting.acted?.at ?? null;
    return waiting.records.some((record) => entry.keys.has(recordKey(record))) ? 'wait' : 'loaded';
  }
  if (inbox.cards.some((one) => one.key === key)) {
    // A read sent before the press still shows the card under "Needs you": only a later one counts.
    return entry.actedAt && inbox.now > entry.actedAt ? 'back' : 'wait';
  }
  return 'loaded';
}

/**
 * Says "All 3 properties loaded." once none of the records someone had fetched again is named any
 * more; a card back under "Needs you" says itself what is left.
 */
function useLoaded(inbox: Inbox): Retried {
  const note = useNote();
  const pending = useRef(new Map<string, Pending>());
  useEffect(() => {
    for (const [key, entry] of pending.current) {
      const state = pendingNow(entry, key, inbox);
      if (state === 'wait') continue;
      pending.current.delete(key);
      if (state === 'back') continue;
      const records = entry.card.records;
      const counts: Record<string, number> = {};
      for (const record of records) counts[record.datatype] = (counts[record.datatype] ?? 0) + 1;
      const name = records.length === 1 ? (records[0]?.name ?? null) : null;
      note({ text: `${loadedWords(counts, name)}.` });
    }
  }, [inbox, note]);
  return useCallback((card: RecordsCard) => {
    pending.current.set(card.key, {
      keys: new Set(card.records.map(recordKey)),
      card,
      actedAt: null,
    });
  }, []);
}

function InboxView({ inbox, onRead }: { inbox: Inbox; onRead: () => void }) {
  const [open, setOpen] = useState<Open>(null);
  const loaded = useLoaded(inbox);
  const retried = (card: RecordsCard) => {
    loaded(card);
    onRead();
  };
  const now = new Date(inbox.now);
  const down = !inbox.worker.ok;
  const count = inbox.cards.length;
  const close = () => setOpen(null);
  const closeAndRead = () => {
    setOpen(null);
    onRead();
  };
  return (
    <>
      {down && <DownBanner inbox={inbox} now={now} />}
      <h1 className="k-page-title">Inbox</h1>
      <p className="k-page-sub">
        {count === 0
          ? 'Nothing needs you right now'
          : counted(count, 'thing needs you', 'things need you')}
      </p>
      {!down && <Strip />}
      {count === 0 && !down && <Empty />}
      {count > 0 && !down && (
        <div className="k-section">
          <h2>Needs you</h2>
          <span className="k-section-note">Urgent first, then oldest first.</span>
        </div>
      )}
      {count > 0 && (
        <div style={down ? { marginTop: 32 } : undefined}>
          {inbox.cards.map((card) => (
            <OneCard
              key={card.key}
              card={card}
              inbox={inbox}
              now={now}
              onOpen={setOpen}
              onRetried={retried}
            />
          ))}
        </div>
      )}
      {!down && inbox.waiting.length + inbox.setup.length > 0 && (
        <>
          <div className="k-section k-section-quiet">
            <h2>Waiting</h2>
          </div>
          {inbox.waiting.map((card) => (
            <WaitingCard key={card.key} card={card} now={now} />
          ))}
          {inbox.setup.map((card) => (
            <Setup key={card.key} card={card} now={now} onOpen={setOpen} />
          ))}
        </>
      )}
      {!down && <FixedToday fixed={inbox.fixed} now={now} />}

      {open?.kind === 'bell' && (
        <BellSecretWindow card={open.card} now={now} onClose={close} onDone={closeAndRead} />
      )}
      {open?.kind === 'ask' && <AskWindow card={open.card} now={now} onClose={close} />}
    </>
  );
}

/** `/admin/`: the Inbox, for a signed-in device; anyone else goes to the sign-in page. */
export function InboxPage() {
  return (
    <Shell tab="inbox" ownCount>
      <InboxReader />
    </Shell>
  );
}

function InboxReader() {
  const { setCount, away } = useShell();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const read = useCallback(() => {
    api.inbox().then(
      (next) => {
        setInbox(next);
        setCount(next.cards.length);
        setFailed(null);
      },
      (error: unknown) => {
        if (!away(error)) setFailed(failureWords(error));
      },
    );
  }, [away, setCount]);

  useEffect(() => {
    read();
    const timer = setInterval(read, EVERY_MS);
    const back = () => {
      if (document.visibilityState === 'visible') read();
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', back);
    };
  }, [read]);

  return (
    <main className="k-page">
      {inbox && <InboxView inbox={inbox} onRead={read} />}
      {failed && (
        <p className="k-quiet" role="status">
          {failed} The Inbox tries again by itself.
        </p>
      )}
    </main>
  );
}
