// The Inbox (design B, images 05, 19, 44 and 45): Core's state, then what needs you, urgent first
// and then oldest first. The page reads again by itself, so a problem that is put right leaves it.
// The buttons that open the windows of later parts (Resend, Enter new login, Fix bell secret, Turn
// on…, Open <brokerage>) are shown but do nothing yet.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  api,
  signedOut,
  type Card,
  type CheckCard,
  type FormsCard,
  type Inbox,
  type Level,
  type LoginCard,
  type Me,
  type SiteCard,
  type WorkerCard,
} from './api';
import { TopBar } from './TopBar';
import { ago, counted, listed, sentWhen, when, dateOf } from './time';
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleCheckIcon,
  CopyIcon,
  KeyIcon,
  PencilIcon,
  SendIcon,
  TrafficConeIcon,
} from './icons';

const EVERY_MS = 30_000;

const LEVELS: Record<Level, { words: string; colour: string }> = {
  P0: { words: 'Down', colour: 'red' },
  P1: { words: 'Urgent', colour: 'red' },
  P2: { words: 'Needs a look', colour: 'orange' },
};

/** A button whose window belongs to a later part: shown as B draws it, and does nothing yet. */
function Later({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <button type="button" className="k-button k-button-primary" aria-disabled="true">
      {icon}
      {children}
    </button>
  );
}

function OpenBrokerage({ name }: { name: string }) {
  return (
    <button type="button" className="k-button k-button-link" aria-disabled="true">
      Open {name}
    </button>
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
  const level = LEVELS[card.level];
  return (
    <article className={`k-card k-card-${card.level}`}>
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

/** "Sent from granstedtbostad.se last night, when Vitec didn’t answer." */
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
  const forms = counted(card.count, 'form', 'forms');
  const again = card.answeredAgainAt
    ? ` ${card.crms.length > 1 ? 'They have' : 'It has'} answered again since ${when(card.answeredAgainAt, now)}.`
    : '';
  return (
    <Frame
      card={card}
      who={card.tenant.name}
      now={now}
      title={`${counted(card.count, 'visitor form', 'visitor forms')} didn’t reach ${listed(card.crms) || 'the CRM'}`}
      actions={
        <>
          <Later icon={<SendIcon />}>Resend {forms}</Later>
          <OpenBrokerage name={card.tenant.name} />
        </>
      }
    >
      <p className="k-card-body">
        {sentSentence(card, now)}
        {again} Core keeps the {card.count === 1 ? 'form' : 'forms'} until {dateOf(card.keptUntil)}.
      </p>
    </Frame>
  );
}

function Login({ card, now }: { card: LoginCard; now: Date }) {
  return (
    <Frame
      card={card}
      who={card.tenant?.name ?? card.crm}
      now={now}
      title={`${card.crm} refused the login`}
      actions={
        <>
          <Later icon={<PencilIcon />}>Enter new login</Later>
          {card.tenant && <OpenBrokerage name={card.tenant.name} />}
        </>
      }
    >
      <p className="k-card-body">
        Changes are held back since then. Usually a changed password or an ended {card.crm}{' '}
        subscription.
      </p>
    </Frame>
  );
}

/** Why a website stopped updating, from how it last answered Core's change notice. */
function siteCause(card: SiteCard, now: Date): string {
  const at = card.lastAnswerAt ? ` at ${when(card.lastAnswerAt, now)}` : '';
  const code = /^http (\d+)$/.exec(card.lastAnswer ?? '')?.[1];
  if (code === '401' || code === '403') {
    return `The website refuses Core’s change notices (it answered ${code}${at}): its bell secret doesn’t match Core’s.`;
  }
  if (code)
    return `The website answers Core’s change notices with an error (it answered ${code}${at}).`;
  if (card.lastAnswer === 'failed')
    return `The website doesn’t answer Core’s change notices (no answer${at}).`;
  if (card.lastAnswer === 'ok') {
    return `The website takes Core’s change notices (the last${at}) but doesn’t fetch the changes: the tenant token it uses may not be Core’s.`;
  }
  return 'Core can’t tell why from the website’s answers.';
}

function Site({ card, now }: { card: SiteCard; now: Date }) {
  const secret = /^http (401|403)$/.test(card.lastAnswer ?? '');
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
          {secret && <Later icon={<KeyIcon />}>Fix bell secret</Later>}
          {card.tenant && <OpenBrokerage name={card.tenant.name} />}
        </>
      }
    >
      <p className="k-card-body">
        {fetched} {siteCause(card, now)} Visitors see properties that have since changed or gone.
      </p>
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
              <OpenBrokerage key={tenant.id} name={tenant.name} />
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

function OneCard({ card, inbox, now }: { card: Card; inbox: Inbox; now: Date }) {
  switch (card.kind) {
    case 'worker':
      return <Worker card={card} crms={inbox.crms} now={now} />;
    case 'forms':
      return <Forms card={card} now={now} />;
    case 'login':
      return <Login card={card} now={now} />;
    case 'site':
      return <Site card={card} now={now} />;
    case 'check':
      return <Check card={card} now={now} />;
  }
}

function Strip({ inbox }: { inbox: Inbox }) {
  return (
    <section className="k-strip" aria-label="Core">
      <div className="k-strip-state">
        <span className="k-pill k-pill-green">Core running</span>
        Worker and database OK
      </div>
      <div className="k-strip-end">
        Maintenance: {inbox.maintenance.on ? 'on' : 'off'}
        {!inbox.maintenance.on && (
          <button
            type="button"
            className="k-button k-button-quiet k-button-small"
            aria-disabled="true"
          >
            <TrafficConeIcon size={14} />
            Turn on…
          </button>
        )}
      </div>
    </section>
  );
}

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

function Empty({ crms }: { crms: string[] }) {
  const connection = crms.length === 1 ? `${crms[0] ?? ''} connection` : 'CRM connection';
  return (
    <section className="k-empty">
      <CircleCheckIcon size={50} strokeWidth={1.3} />
      <h2>Nothing needs you</h2>
      <p>Every brokerage, {connection} and website is working.</p>
    </section>
  );
}

function InboxView({ inbox }: { inbox: Inbox }) {
  const now = new Date(inbox.now);
  const down = !inbox.worker.ok;
  const count = inbox.cards.length;
  return (
    <>
      {down && <DownBanner inbox={inbox} now={now} />}
      <h1 className="k-page-title">Inbox</h1>
      <p className="k-page-sub">
        {count === 0
          ? 'Nothing needs you right now'
          : counted(count, 'thing needs you', 'things need you')}
      </p>
      {!down && <Strip inbox={inbox} />}
      {count === 0 && !down && <Empty crms={inbox.crms} />}
      {count > 0 && !down && (
        <div className="k-section">
          <h2>Needs you</h2>
          <span className="k-section-note">Urgent first, then oldest first.</span>
        </div>
      )}
      {count > 0 && (
        <div style={down ? { marginTop: 32 } : undefined}>
          {inbox.cards.map((card) => (
            <OneCard key={card.key} card={card} inbox={inbox} now={now} />
          ))}
        </div>
      )}
    </>
  );
}

/** `/admin/`: the Inbox, for a signed-in device; anyone else goes to the sign-in page. */
export function InboxPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [failed, setFailed] = useState(false);

  const away = useCallback(
    (error: unknown) => {
      if (signedOut(error)) navigate('/sign-in', { replace: true });
      else setFailed(true);
    },
    [navigate],
  );

  const read = useCallback(() => {
    api.inbox().then((next) => {
      setInbox(next);
      setFailed(false);
    }, away);
  }, [away]);

  useEffect(() => {
    api.me().then(setMe, away);
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
  }, [away, read]);

  if (!me) return null;
  return (
    <>
      <TopBar me={me} count={inbox?.cards.length ?? 0} />
      <main className="k-page">
        {inbox && <InboxView inbox={inbox} />}
        {failed && (
          <p className="k-quiet" role="status">
            Core didn’t answer. The Inbox tries again by itself.
          </p>
        )}
      </main>
    </>
  );
}
