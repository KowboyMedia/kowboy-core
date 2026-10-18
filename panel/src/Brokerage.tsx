// One brokerage's page (design B, images 11, 12 and 24 to 38): its websites, a card for each CRM
// with its connections, its tenant token and its switch, and the windows that change them. The
// page updates by itself, so a website's new token and a removal reaching the websites show
// without a reload.
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  api,
  Refused,
  type Brokerage,
  type ConnectionView,
  type Crm,
  type Office,
  type ReloadView,
  type Website,
} from './api';
import { Shell, useShell } from './Shell';
import { StatusBadge } from './Brokerages';
import { Badge, DotsMenu, Modal, Switch, UNANSWERED, useNote, ValueField, type Tone } from './ui';
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  CircleCheckIcon,
  KeyIcon,
  LoaderIcon,
  PencilIcon,
  PlugIcon,
  PlusIcon,
  PowerIcon,
  RefreshIcon,
  TrashIcon,
} from './icons';
import { isTestSystem, loginLine, systemShort, wordsFor } from './crm-words';
import { clock, listed, when } from './time';
import { loadedList, records } from './records';
import {
  clientLine,
  newWebsite,
  platformOf,
  platformWords,
  SettingsToPaste,
  WebsiteFields,
  websiteReady,
  type Platform,
} from './websites';
import {
  ConnectFields,
  connect,
  connectReady,
  LoginWindow,
  loginRefusal,
  owning,
  shortName,
  useConnectForm,
} from './connect';

const SLOW_MS = 15_000;
const FAST_MS = 4_000;

// ---- Reading the page ------------------------------------------------------------------------------

type Load = 'loading' | 'missing' | 'failed' | 'ok';

function usePage(id: number, fast: boolean) {
  const { away } = useShell();
  const [page, setPage] = useState<Brokerage | null>(null);
  const [state, setState] = useState<Load>('loading');
  const load = useCallback(async () => {
    try {
      setPage(await api.brokerage(id));
      setState('ok');
    } catch (error) {
      if (away(error)) return;
      if (error instanceof Refused && error.status === 404) setState('missing');
      else setState((was) => (was === 'ok' ? 'ok' : 'failed'));
    }
  }, [id, away]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), fast ? FAST_MS : SLOW_MS);
    return () => clearInterval(timer);
  }, [load, fast]);
  return { page, state, load };
}

/** "a, b and c" for pieces of a sentence that are not plain text. */
function joined(parts: ReactNode[]): ReactNode {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (index === parts.length - 1 ? ' and ' : ', ')}
      {part}
    </Fragment>
  ));
}

/** The CRMs a brokerage uses, by name, for a sentence: "Vitec". */
function crmWords(page: Brokerage): string {
  const names = [...new Set(page.connections.map((connection) => connection.crm))];
  if (names.length === 0 && page.crms[0]) names.push(page.crms[0].name);
  return listed(names, 'or');
}

const crmFor = (page: Brokerage, provider: string): Crm =>
  page.crms.find((crm) => crm.provider === provider) ?? { provider, name: provider, fields: [] };

/** "Varberg and Falkenberg and their 61 properties", for the message after a removal. */
function whatLeft(offices: string[], properties: number, test: boolean): string {
  const homes = records(properties, 'property', test ? 'test ' : '');
  if (offices.length === 0) return properties > 0 ? `Its ${homes}` : '';
  if (properties === 0) return listed(offices);
  return `${listed(offices)} and ${offices.length === 1 ? 'its' : 'their'} ${homes}`;
}

// ---- Websites ---------------------------------------------------------------------------------------

function websiteStatus(
  website: Website,
  active: boolean,
  switched: boolean,
): { words: string; tone: Tone } | null {
  if (!active) return { words: 'Off', tone: 'grey' };
  if (website.waitingForToken) return { words: 'Waiting for new token', tone: 'orange' };
  if (switched) return { words: 'Uses new token', tone: 'green' };
  if (website.behind) return { words: 'Needs a look', tone: 'orange' };
  if (!website.lastFetchAt) return null;
  return { words: 'OK', tone: 'green' };
}

function WebsitesCard({
  page,
  switched,
  onAdd,
  onRemove,
}: {
  page: Brokerage;
  switched: Set<number>;
  onAdd: () => void;
  onRemove: (website: Website) => void;
}) {
  const now = new Date(page.now);
  return (
    <section className="k-box">
      <header className="k-box-head">
        <h2>Websites</h2>
        <button type="button" className="k-button k-button-quiet k-button-small" onClick={onAdd}>
          <PlusIcon size={16} />
          Add website
        </button>
      </header>
      {page.websites.length === 0 && (
        <p className="k-box-empty">No website yet. Add one with “Add website”.</p>
      )}
      {page.websites.map((website) => {
        const status = websiteStatus(website, page.active, switched.has(website.id));
        return (
          <div key={website.id} className="k-row">
            <div className="k-row-main">
              <div className="k-row-name">{website.label}</div>
              <div className="k-row-sub">{clientLine(website)}</div>
            </div>
            <div className="k-row-end">
              {status && <Badge tone={status.tone}>{status.words}</Badge>}
              {website.lastFetchAt && (
                <span className="k-row-time">Last sync {when(website.lastFetchAt, now)}</span>
              )}
              <span className="k-row-buttons">
                <button
                  type="button"
                  className="k-button k-button-quiet k-button-small"
                  aria-disabled="true"
                >
                  Settings
                </button>
                <DotsMenu
                  label={`More for ${website.label}`}
                  items={[
                    {
                      label: 'Edit label and address',
                      icon: <PencilIcon size={16} />,
                      later: true,
                    },
                    { label: 'New bell secret…', icon: <KeyIcon size={16} />, later: true },
                    {
                      label: 'Remove website…',
                      icon: <TrashIcon size={16} />,
                      danger: true,
                      apart: true,
                      onSelect: () => onRemove(website),
                    },
                  ]}
                />
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Add a website: its fields, then the settings to copy into it until it fetches (images 08, 09). */
function AddWebsiteWindow({ page, onClose }: { page: Brokerage; onClose: () => void }) {
  const { away } = useShell();
  const note = useNote();
  const [draft, setDraft] = useState(newWebsite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id: number; platform: Platform } | null>(null);
  const website = added ? page.websites.find((one) => one.id === added.id) : undefined;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.addWebsite(page.id, {
        label: draft.label.trim(),
        bellUrl: draft.bellUrl.trim(),
      });
      setAdded({ id, platform: draft.platform });
      note({ text: `${draft.label.trim()} added.` });
    } catch (failure) {
      if (away(failure)) return;
      setError(
        failure instanceof Refused && failure.status === 400
          ? 'Check the bell address: it starts with https://.'
          : UNANSWERED,
      );
    } finally {
      setBusy(false);
    }
  };

  const title = `Add ${owning(shortName(page.name))} website`;
  if (added) {
    const now = new Date(page.now);
    return (
      <Modal
        title={title}
        onClose={onClose}
        wide
        footer={
          <button type="button" className="k-button k-button-link k-end" onClick={onClose}>
            Close
          </button>
        }
      >
        {website?.lastFetchAt ? (
          <div className="k-done-line">
            <strong>{website.label} is connected.</strong> It fetched its data at{' '}
            {when(website.lastFetchAt, now)}
            {website.client ? ` (${clientLine(website)})` : ''}.
          </div>
        ) : website ? (
          <>
            <h3 className="k-step-head">Waiting for {website.label} to contact Core</h3>
            <SettingsToPaste
              coreUrl={page.coreUrl}
              token={page.token}
              bellSecret={website.bellSecret}
              platform={added.platform}
            />
          </>
        ) : (
          <p className="k-quiet">{UNANSWERED}</p>
        )}
      </Modal>
    );
  }
  return (
    <Modal
      title={title}
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
            disabled={busy || !websiteReady(draft)}
            onClick={() => void save()}
          >
            Save and continue
          </button>
        </>
      }
    >
      <WebsiteFields draft={draft} onChange={setDraft} />
      {error && <p className="k-error">{error}</p>}
    </Modal>
  );
}

function RemoveWebsiteWindow({
  website,
  onClose,
  onRemoved,
}: {
  website: Website;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { away } = useShell();
  const note = useNote();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const remove = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await api.removeWebsite(website.id);
      note({ text: `${website.label} removed.` });
      onRemoved();
    } catch (error) {
      if (!away(error)) setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Remove ${website.label}?`}
      tone="danger"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="k-button k-button-danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            <TrashIcon size={18} />
            Remove website
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        Core stops telling it about changes and deletes its history. A website that is shut down
        needs nothing more; one still running keeps its last copy and could still fetch data with
        the tenant token. To stop serving a brokerage that has left, switch the brokerage off
        instead.
      </p>
      {failed && <p className="k-error">{UNANSWERED}</p>}
    </Modal>
  );
}

// ---- A CRM and its connections ------------------------------------------------------------------

function CrmCard({
  page,
  crm,
  onConnect,
  onOffices,
  onLogin,
  onRemove,
  onTestMode,
}: {
  page: Brokerage;
  crm: Crm;
  onConnect: () => void;
  onOffices: (connection: ConnectionView) => void;
  onLogin: (connection: ConnectionView) => void;
  onRemove: (connection: ConnectionView) => void;
  onTestMode: (connection: ConnectionView, on: boolean) => void;
}) {
  const now = new Date(page.now);
  const connections = page.connections.filter((one) => one.provider === crm.provider);
  return (
    <section className="k-box">
      <header className="k-box-head">
        <h2>{crm.name}</h2>
        <button
          type="button"
          className="k-button k-button-quiet k-button-small"
          onClick={onConnect}
        >
          <PlusIcon size={16} />
          Connect {crm.name}
        </button>
      </header>
      {connections.length === 0 && (
        <p className="k-box-empty">
          No {crm.name} connection yet. Connect one with “Connect {crm.name}”.
        </p>
      )}
      {connections.map((connection) => {
        const short = systemShort(crm.name, crm.provider, connection.login);
        return (
          <div key={connection.id} className="k-row k-row-stack">
            <div className="k-row-top">
              <div className="k-row-main">
                <div className="k-row-name">{connection.name}</div>
                <div className="k-row-sub">
                  {[
                    loginLine(crm.name, crm.provider, connection.login),
                    records(connection.counts.property, 'property'),
                  ].join(' · ')}
                </div>
              </div>
              <div className="k-row-end">
                <span className="k-row-buttons">
                  <button
                    type="button"
                    className="k-button k-button-quiet k-button-small"
                    onClick={() => onOffices(connection)}
                  >
                    Offices
                  </button>
                  <button
                    type="button"
                    className="k-button k-button-quiet k-button-small"
                    onClick={() => onLogin(connection)}
                  >
                    Change login
                  </button>
                  <DotsMenu
                    label={`More for ${connection.name}`}
                    items={[
                      { label: 'Rename', icon: <PencilIcon size={16} />, later: true },
                      {
                        label: 'Remove connection…',
                        icon: <TrashIcon size={16} />,
                        danger: true,
                        apart: true,
                        onSelect: () => onRemove(connection),
                      },
                    ]}
                  />
                </span>
              </div>
            </div>
            <div className="k-row-bottom">
              <span className="k-row-sub">
                Offices:{' '}
                {connection.offices.length > 0 ? connection.offices.join(', ') : 'none yet'}
              </span>
              {page.active ? (
                <Switch
                  on={connection.formsTestMode}
                  label="Forms test mode"
                  onChange={(on) => onTestMode(connection, on)}
                />
              ) : (
                <span className="k-row-sub">Forms: refused (brokerage off)</span>
              )}
            </div>
            {page.active && connection.formsTestMode && (
              <p className="k-warning">
                <AlertTriangleIcon size={16} />
                <span>
                  {connection.formsTestModeSince
                    ? `On since ${when(connection.formsTestModeSince, now)}. `
                    : 'On. '}
                  Forms stop in Core and never reach {short}; the website is told “not sent”.
                  Nothing is sent later.
                </span>
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Connect the brokerage to a CRM from its page: the wizard's second step in a window. */
function ConnectWindow({
  page,
  crm,
  onClose,
  onDone,
}: {
  page: Brokerage;
  crm: Crm;
  onClose: () => void;
  onDone: () => void;
}) {
  const { away } = useShell();
  const note = useNote();
  const short = shortName(page.name);
  const form = useConnectForm(crm);
  const save = async () => {
    form.setBusy(true);
    form.setError(null);
    try {
      const { name } = await connect(page.id, crm, form.login);
      note({
        text: `${crm.name} accepted the login. “${name}” is saved, and Core is loading its data.`,
      });
      onDone();
    } catch (error) {
      if (away(error)) return;
      form.setError(loginRefusal(error, crm.name));
      form.setBusy(false);
    }
  };
  return (
    <Modal
      title={`Connect ${owning(short)} ${crm.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Cancel
          </button>
          <span className="k-foot-note">
            Core tests the login with {crm.name} and saves it only if {crm.name} accepts it.
          </span>
          <button
            type="button"
            className="k-button k-button-primary"
            disabled={form.busy || !connectReady(crm, form)}
            onClick={() => void save()}
          >
            {form.busy ? <LoaderIcon className="k-spin" size={18} /> : <PlugIcon size={18} />}
            Test and save
          </button>
        </>
      }
    >
      <ConnectFields crm={crm} form={form} />
      {form.error && <p className="k-error">{form.error}</p>}
    </Modal>
  );
}

/** A connection's offices on the websites (images 25, 26), and checking them now. */
function OfficesWindow({
  crm,
  connection,
  onClose,
}: {
  crm: Crm;
  connection: ConnectionView;
  onClose: () => void;
}) {
  const { away } = useShell();
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [queued, setQueued] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const check = wordsFor(crm.provider).officeCheck;
  const canCheck = check !== undefined && connection.actions.includes(check);

  useEffect(() => {
    api.offices(connection.id).then(
      (answer) => setOffices(answer.offices),
      (error: unknown) => {
        if (!away(error)) setFailed(true);
      },
    );
  }, [connection.id, away]);

  const checkNow = async () => {
    if (!check) return;
    setCheckFailed(false);
    setQueued(true);
    try {
      await api.act(connection.id, check);
    } catch (error) {
      if (away(error)) return;
      setQueued(false);
      setCheckFailed(true);
    }
  };

  return (
    <Modal
      title={`Offices · ${connection.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Close
          </button>
          {canCheck && (
            <button
              type="button"
              className={`k-button ${queued ? 'k-button-quiet k-button-spent' : 'k-button-primary'}`}
              disabled={queued}
              onClick={() => void checkNow()}
            >
              <RefreshIcon size={18} />
              Check offices now
            </button>
          )}
        </>
      }
    >
      {failed && <p className="k-error">{UNANSWERED}</p>}
      {offices && offices.length === 0 && (
        <p className="k-quiet k-quiet-tight">Core holds no offices for this connection yet.</p>
      )}
      {offices && offices.length > 0 && (
        <table className="k-table k-table-plain">
          <thead>
            <tr>
              <th>Office</th>
              <th>Status</th>
              <th>Properties</th>
            </tr>
          </thead>
          <tbody>
            {offices.map((office) => (
              <tr key={office.id}>
                <td className="k-strong">{office.name}</td>
                <td>
                  <Badge tone="green">On the websites</Badge>
                </td>
                <td className="k-muted">{records(office.properties, 'property')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {queued && (
        <p className="k-queued">
          <LoaderIcon className="k-spin" size={18} />
          Office check queued — it runs within a minute.
        </p>
      )}
      {checkFailed && <p className="k-error">{UNANSWERED}</p>}
    </Modal>
  );
}

/** What removing a connection takes off the websites (image 35). */
function RemoveConnectionWindow({
  page,
  crm,
  connection,
  onClose,
  onRemoved,
}: {
  page: Brokerage;
  crm: Crm;
  connection: ConnectionView;
  onClose: () => void;
  onRemoved: (removedAt: string) => void;
}) {
  const { away } = useShell();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sites = page.websites.map((website) => website.label);
  const what = loadedList(connection.counts);
  const offices = connection.offices;
  if (offices.length > 0) {
    what.push(`the office${offices.length === 1 ? '' : 's'} ${listed(offices)}`);
  }
  const short = systemShort(crm.name, crm.provider, connection.login);
  const leaving =
    what.length === 0
      ? 'It holds no records yet.'
      : sites.length === 0
        ? `Its ${listed(what)} leave Core.`
        : `Its ${listed(what)} leave ${listed(sites)} within minutes — Core tells the website${sites.length === 1 ? '' : 's'} at once.`;

  const remove = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const { removedAt } = await api.removeConnection(connection.id);
      onRemoved(removedAt);
    } catch (error) {
      if (!away(error)) setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Remove “${connection.name}”?`}
      tone="danger"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="k-button k-button-danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            <TrashIcon size={18} />
            Remove connection
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        {leaving} Its form history (forms sent to {short}) is deleted. This can’t be undone.
      </p>
      {failed && <p className="k-error">{UNANSWERED}</p>}
    </Modal>
  );
}

// ---- The tenant token -------------------------------------------------------------------------------

function TokenCard({ page, onReplace }: { page: Brokerage; onReplace: () => void }) {
  return (
    <section className="k-box">
      <header className="k-box-head">
        <h2>Tenant token</h2>
        <button
          type="button"
          className="k-button k-button-quiet k-button-small"
          onClick={onReplace}
        >
          <RefreshIcon size={16} />
          Replace…
        </button>
      </header>
      <div className="k-box-body">
        {page.token ? (
          <ValueField value={page.token} secret />
        ) : (
          <p className="k-row-sub">
            Core keeps no copy of this brokerage’s token. Replacing it makes one you can copy.
          </p>
        )}
        <p className="k-help">
          The secret key all of this brokerage’s websites use to fetch data and send forms.
        </p>
      </div>
    </section>
  );
}

function ReplaceTokenWindow({
  page,
  onClose,
  onReplaced,
}: {
  page: Brokerage;
  onClose: () => void;
  onReplaced: (token: string) => void;
}) {
  const { away } = useShell();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sites = page.websites;
  const named = sites.map((website) => {
    const platform = platformOf(website);
    return (
      <Fragment key={website.id}>
        <strong>{website.label}</strong>
        {platform ? ` (${platformWords(platform).editIn})` : ''}
      </Fragment>
    );
  });
  const ready =
    sites.length === 1
      ? 'Have it ready to edit before you replace it.'
      : sites.length === 2
        ? 'Have both ready to edit before you replace it.'
        : 'Have them all ready to edit before you replace it.';

  const replace = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const { token } = await api.replaceToken(page.id);
      onReplaced(token);
    } catch (error) {
      if (!away(error)) setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Replace tenant token?"
      tone="danger"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="k-button k-button-danger"
            disabled={busy}
            onClick={() => void replace()}
          >
            <RefreshIcon size={18} />
            Replace token
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        The current token stops working at once.{' '}
        {sites.length === 0 ? (
          'No website uses it yet.'
        ) : (
          <>
            Until each website has the new one, it can’t fetch data, and its visitors’ forms are
            turned away and not kept: {joined(named)}. {ready}
          </>
        )}
      </p>
      {failed && <p className="k-error">{UNANSWERED}</p>}
    </Modal>
  );
}

/** The new token, and where each website takes it, until every one uses it (image 29). */
function TokenReplacedWindow({
  page,
  token,
  onClose,
}: {
  page: Brokerage;
  token: string;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`Token replaced · ${page.name}`}
      tone="warn"
      onClose={onClose}
      wide
      footer={
        <button type="button" className="k-button k-button-link k-end" onClick={onClose}>
          Close
        </button>
      }
    >
      <span className="k-label">New tenant token</span>
      <ValueField value={token} secret primaryCopy />
      {page.websites.length > 0 && (
        <>
          <p className="k-modal-text k-modal-lead">Copy it into each website:</p>
          <div className="k-list-box">
            {page.websites.map((website) => {
              const platform = platformOf(website);
              return (
                <div key={website.id} className="k-list-row">
                  <div className="k-row-main">
                    <div className="k-row-name">{website.label}</div>
                    {platform && <div className="k-row-sub">{platformWords(platform).token}</div>}
                  </div>
                  {website.waitingForToken ? (
                    <Badge tone="orange">Waiting for new token</Badge>
                  ) : (
                    <Badge tone="green">Uses new token</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="k-modal-text k-modal-lead">This page updates by itself.</p>
    </Modal>
  );
}

// ---- Reload all data ------------------------------------------------------------------------------

/** The CRMs a brokerage's connections are with, in a sentence that names them all: "Vitec". */
function fetchedFrom(page: Brokerage): string {
  return listed([...new Set(page.connections.map((connection) => connection.crm))]);
}

/** "Reload all data for Mäklarbyrån Ljungström?" (image 39). */
function ReloadWindow({
  page,
  onClose,
  onDone,
}: {
  page: Brokerage;
  onClose: () => void;
  onDone: () => void;
}) {
  const { away } = useShell();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const crms = fetchedFrom(page);
  const sites = page.websites.map((website) => website.label);
  const fetch =
    page.connections.length > 0
      ? `Core fetches everything from ${crms} again and removes what ${crms} no longer lists. `
      : '';
  const then = fetch ? 'Then ' : '';
  const reload =
    sites.length === 0
      ? ''
      : sites.length === 1
        ? `${then}${sites[0] ?? ''} reloads everything. The website keeps showing its copy meanwhile. `
        : `${then}${listed(sites)} reload everything. The websites keep showing their copy meanwhile. `;
  const off =
    !page.active && sites.length > 0 ? 'They reload once the brokerage is switched on. ' : '';
  const go = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await api.reload(page.id);
      onDone();
    } catch (error) {
      if (!away(error)) setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Reload all data for ${page.name}?`}
      tone="info"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="k-button k-button-primary"
            disabled={busy}
            onClick={() => void go()}
          >
            {busy ? <LoaderIcon className="k-spin" size={18} /> : <RefreshIcon size={18} />}
            Reload all data
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        {fetch}
        {reload}
        {off}Takes a few minutes.
      </p>
      {failed && <p className="k-error">{UNANSWERED}</p>}
    </Modal>
  );
}

/** "Vitec no longer lists 1 property: Kopparbergsvägen 8, Västerås — removed." */
function removedWords(reload: ReloadView, crms: string): string {
  if (reload.removedCount === 0)
    return `${crms} lists everything Core had, so nothing was removed.`;
  const from = listed([...new Set(reload.removed.map((one) => one.crm))]) || crms;
  const names = reload.removed.map(
    (one) =>
      one.name ?? `${records(1, one.datatype).replace(/^1 /, '')} with ${one.crm} id ${one.id}`,
  );
  const more = reload.removedCount - reload.removed.length;
  if (more > 0) {
    return `${from} no longer lists ${String(reload.removedCount)} records, among them ${names.join(', ')} — removed.`;
  }
  const types = [...new Set(reload.removed.map((one) => one.datatype))].map((datatype) =>
    records(reload.removed.filter((one) => one.datatype === datatype).length, datatype),
  );
  return `${from} no longer lists ${listed(types)}: ${listed(names)} — removed.`;
}

/** How long the page says a reload is done. */
const DONE_SHOWN_MS = 60 * 60_000;

/** A reload under way, or done (image 40), at the top of the page. */
function ReloadBanner({ page }: { page: Brokerage }) {
  const reload = page.reload;
  if (!reload) return null;
  const crms = fetchedFrom(page) || 'the CRM';
  if (reload.state !== 'done') {
    const waiting = reload.sites
      .filter((site) => site.reloadedAt === null)
      .map((site) => site.label);
    return (
      <section className="k-banner k-banner-info" aria-label="Reload all data">
        <LoaderIcon className="k-spin" size={20} />
        <div>
          <p className="k-banner-title">Reloading all data…</p>
          <p className="k-banner-text">
            {reload.state === 'fetching'
              ? `Core is fetching everything from ${crms} again. The websites keep showing their copy meanwhile.`
              : `Core has fetched everything from ${crms} again. Waiting for ${listed(waiting) || 'the websites'} to reload everything.`}
          </p>
        </div>
      </section>
    );
  }
  if (!reload.doneAt || Date.parse(page.now) - Date.parse(reload.doneAt) > DONE_SHOWN_MS)
    return null;
  const reloaded = reload.sites
    .filter((site) => site.reloadedAt !== null)
    .map((site) => site.label);
  const sites =
    page.active && reloaded.length > 0 ? ` ${listed(reloaded)} reloaded everything.` : '';
  return (
    <section
      className={`k-banner ${reload.failed ? 'k-banner-warn' : 'k-banner-done'}`}
      aria-label="Reload all data"
    >
      {reload.failed ? <AlertTriangleIcon size={20} /> : <CircleCheckIcon size={20} />}
      <div>
        <p className="k-banner-title">
          {reload.failed ? 'Reload done in part' : 'Reload done'} ({clock(reload.doneAt)})
        </p>
        <p className="k-banner-text">
          {reload.failed &&
            `Core couldn’t fetch everything from ${crms} again, so some records may still be missing or out of date; try again in a while. `}
          {removedWords(reload, crms)}
          {sites}
        </p>
      </div>
    </section>
  );
}

// ---- The brokerage's switch -------------------------------------------------------------------------

function BrokerageCard({
  page,
  onSwitch,
  onReload,
}: {
  page: Brokerage;
  onSwitch: (on: boolean) => void;
  onReload: () => void;
}) {
  return (
    <section className="k-box">
      <header className="k-box-head">
        <h2>Brokerage</h2>
      </header>
      <div className="k-box-body">
        <div className="k-box-line">
          <Switch on={page.active} label={page.active ? 'On' : 'Off'} strong onChange={onSwitch} />
          <button
            type="button"
            className="k-button k-button-quiet k-button-small"
            onClick={onReload}
          >
            <RefreshIcon size={16} />
            Reload all data…
          </button>
        </div>
        <p className="k-help">
          Switch off when a customer leaves: its websites can no longer fetch data or send forms.
          Reload: if a website shows something {crmWords(page)} no longer has.
        </p>
      </div>
    </section>
  );
}

function SwitchOffWindow({
  page,
  onClose,
  onDone,
}: {
  page: Brokerage;
  onClose: () => void;
  onDone: () => void;
}) {
  const { away } = useShell();
  const note = useNote();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sites = page.websites.map((website) => website.label);
  const connections = page.connections.length;
  const first =
    sites.length === 0
      ? 'Its websites can no longer fetch data or send forms.'
      : sites.length === 1
        ? `${sites[0] ?? ''} can no longer fetch data or send forms; it keeps showing its last copy.`
        : `${listed(sites)} can no longer fetch data or send forms; they keep showing their last copy.`;
  const second =
    connections === 0
      ? 'They can be switched on again.'
      : connections === 1
        ? `Their ${crmWords(page)} connection stays as it is (Core keeps reading it), so they can be switched on again.`
        : `Their ${crmWords(page)} connections stay as they are (Core keeps reading them), so they can be switched on again.`;
  const off = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await api.switchBrokerage(page.id, false);
      note({ text: `${page.name} is switched off.`, icon: 'off' });
      onDone();
    } catch (error) {
      if (!away(error)) setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Switch off ${page.name}?`}
      tone="danger"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="k-button k-button-danger"
            disabled={busy}
            onClick={() => void off()}
          >
            <PowerIcon size={18} />
            Switch off
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        {first} {second}
      </p>
      {failed && <p className="k-error">{UNANSWERED}</p>}
    </Modal>
  );
}

// ---- The page ---------------------------------------------------------------------------------------

type Open =
  | { kind: 'add-website' }
  | { kind: 'remove-website'; website: Website }
  | { kind: 'connect'; crm: Crm }
  | { kind: 'login'; connection: ConnectionView }
  | { kind: 'offices'; connection: ConnectionView }
  | { kind: 'remove-connection'; connection: ConnectionView }
  | { kind: 'replace-token' }
  | { kind: 'token-replaced'; token: string }
  | { kind: 'switch-off' }
  | { kind: 'reload' }
  | null;

/** A connection just removed, until every website it was on has fetched since. */
type Removal = {
  name: string;
  offices: string[];
  properties: number;
  test: boolean;
  at: number;
  sites: number[];
};

function Page({ id }: { id: number }) {
  const { away } = useShell();
  const note = useNote();
  const [open, setOpen] = useState<Open>(null);
  const [switched, setSwitched] = useState<Set<number>>(new Set());
  const [removal, setRemoval] = useState<Removal | null>(null);
  /** A token replaced from this page: armed, then waiting until every website uses it. */
  const [watching, setWatching] = useState<'armed' | 'waiting' | null>(null);
  /** A reload under way, followed until every website has reloaded. */
  const [reloading, setReloading] = useState(false);
  const fast =
    open?.kind === 'token-replaced' || removal !== null || watching !== null || reloading;
  const { page, state, load } = usePage(id, fast);
  const before = useRef<Brokerage | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const closeAndLoad = useCallback(() => {
    setOpen(null);
    void load();
  }, [load]);

  // What changed since the last read: websites that took the new token, a removal that reached
  // every website.
  useEffect(() => {
    setReloading(
      page?.reload !== null && page?.reload !== undefined && page.reload.state !== 'done',
    );
  }, [page]);

  useEffect(() => {
    if (!page) return;
    const was = before.current;
    before.current = page;
    if (was) {
      const took = page.websites.filter(
        (website) =>
          !website.waitingForToken &&
          was.websites.find((one) => one.id === website.id)?.waitingForToken === true,
      );
      if (took.length > 0) {
        setSwitched((ids) => new Set([...ids, ...took.map((website) => website.id)]));
      }
    }
    const waiting = page.websites.some((website) => website.waitingForToken);
    if (watching === 'armed' && waiting) setWatching('waiting');
    if (watching === 'waiting' && !waiting) {
      setWatching(null);
      const n = page.websites.length;
      note({
        text:
          n === 1
            ? `${page.websites[0]?.label ?? ''} uses the new token.`
            : n === 2
              ? 'Both websites use the new token.'
              : `All ${String(n)} websites use the new token.`,
      });
    }
    if (removal) {
      const sites = page.websites.filter((website) => removal.sites.includes(website.id));
      const fetched = sites.every(
        (website) => website.lastFetchAt !== null && Date.parse(website.lastFetchAt) > removal.at,
      );
      if (sites.length === 0 || fetched) {
        setRemoval(null);
        const left = whatLeft(removal.offices, removal.properties, removal.test);
        const last = sites
          .map((website) => website.lastFetchAt ?? '')
          .sort()
          .at(-1);
        note({
          text:
            sites.length > 0 && left && last
              ? `Removed “${removal.name}”. ${left} left ${listed(sites.map((site) => site.label))} at ${when(last, new Date(page.now))}.`
              : `Removed “${removal.name}”.`,
        });
      }
    }
  }, [page, watching, removal, note]);

  if (state === 'missing') {
    return (
      <main className="k-page">
        <Link className="k-back" to="/brokerages">
          <ChevronLeftIcon size={16} />
          Brokerages
        </Link>
        <p className="k-quiet">There is no brokerage at this address.</p>
      </main>
    );
  }
  if (state === 'failed') {
    return (
      <main className="k-page">
        <p className="k-quiet">Core didn’t answer. Reload the page in a moment.</p>
      </main>
    );
  }
  if (!page) return null;

  const testMode = async (connection: ConnectionView, on: boolean) => {
    try {
      await api.formsTestMode(connection.id, on);
    } catch (error) {
      if (!away(error)) note({ text: UNANSWERED, icon: 'warn' });
      return;
    }
    const sites = listed(page.websites.map((website) => website.label));
    const crm = crmFor(page, connection.provider);
    note(
      on
        ? {
            text: `Forms test mode is on for ${connection.name}. Forms from ${sites || 'its websites'} stop in Core.`,
            icon: 'warn',
          }
        : {
            text: `Forms test mode is off for ${connection.name}. Forms go to ${systemShort(crm.name, crm.provider, connection.login)} again.`,
          },
    );
    void load();
  };

  const switchOn = async () => {
    try {
      await api.switchBrokerage(page.id, true);
      note({ text: `${page.name} is switched on. Its websites fetch what changed meanwhile.` });
      void load();
    } catch (error) {
      if (!away(error)) note({ text: UNANSWERED, icon: 'warn' });
    }
  };

  const removed = (connection: ConnectionView, removedAt: string) => {
    const crm = crmFor(page, connection.provider);
    const sites = page.active ? page.websites.map((website) => website.id) : [];
    setOpen(null);
    if (sites.length === 0) {
      note({ text: `Removed “${connection.name}”.` });
    } else {
      note({
        text: `Removed “${connection.name}”. Waiting for ${listed(page.websites.map((website) => website.label))} to fetch the change.`,
      });
      setRemoval({
        name: connection.name,
        offices: connection.offices,
        properties: connection.counts.property,
        test: isTestSystem(crm.provider, connection.login),
        at: Date.parse(removedAt),
        sites,
      });
    }
    void load();
  };

  return (
    <main className="k-page">
      <Link className="k-back" to="/brokerages">
        <ChevronLeftIcon size={16} />
        Brokerages
      </Link>
      <div className="k-title-line">
        <h1 className="k-page-title k-page-title-large">{page.name}</h1>
        <StatusBadge status={page.status} />
      </div>
      <ReloadBanner page={page} />

      <WebsitesCard
        page={page}
        switched={switched}
        onAdd={() => setOpen({ kind: 'add-website' })}
        onRemove={(website) => setOpen({ kind: 'remove-website', website })}
      />
      {page.crms.map((crm) => (
        <CrmCard
          key={crm.provider}
          page={page}
          crm={crm}
          onConnect={() => setOpen({ kind: 'connect', crm })}
          onOffices={(connection) => setOpen({ kind: 'offices', connection })}
          onLogin={(connection) => setOpen({ kind: 'login', connection })}
          onRemove={(connection) => setOpen({ kind: 'remove-connection', connection })}
          onTestMode={(connection, on) => void testMode(connection, on)}
        />
      ))}
      <TokenCard page={page} onReplace={() => setOpen({ kind: 'replace-token' })} />
      <BrokerageCard
        page={page}
        onSwitch={(on) => (on ? void switchOn() : setOpen({ kind: 'switch-off' }))}
        onReload={() => setOpen({ kind: 'reload' })}
      />

      {open?.kind === 'add-website' && <AddWebsiteWindow page={page} onClose={closeAndLoad} />}
      {open?.kind === 'remove-website' && (
        <RemoveWebsiteWindow website={open.website} onClose={close} onRemoved={closeAndLoad} />
      )}
      {open?.kind === 'connect' && (
        <ConnectWindow page={page} crm={open.crm} onClose={close} onDone={closeAndLoad} />
      )}
      {open?.kind === 'login' && (
        <LoginWindow
          crm={crmFor(page, open.connection.provider)}
          connection={open.connection}
          onClose={close}
          onDone={closeAndLoad}
        />
      )}
      {open?.kind === 'offices' && (
        <OfficesWindow
          crm={crmFor(page, open.connection.provider)}
          connection={open.connection}
          onClose={close}
        />
      )}
      {open?.kind === 'remove-connection' && (
        <RemoveConnectionWindow
          page={page}
          crm={crmFor(page, open.connection.provider)}
          connection={open.connection}
          onClose={close}
          onRemoved={(removedAt) => removed(open.connection, removedAt)}
        />
      )}
      {open?.kind === 'replace-token' && (
        <ReplaceTokenWindow
          page={page}
          onClose={close}
          onReplaced={(token) => {
            setOpen({ kind: 'token-replaced', token });
            setSwitched(new Set());
            setWatching('armed');
            void load();
          }}
        />
      )}
      {open?.kind === 'token-replaced' && (
        <TokenReplacedWindow page={page} token={open.token} onClose={close} />
      )}
      {open?.kind === 'switch-off' && (
        <SwitchOffWindow page={page} onClose={close} onDone={closeAndLoad} />
      )}
      {open?.kind === 'reload' && (
        <ReloadWindow
          page={page}
          onClose={close}
          onDone={() => {
            setReloading(true);
            closeAndLoad();
          }}
        />
      )}
    </main>
  );
}

/** `/admin/brokerages/<id>`. */
export function BrokeragePage() {
  const { id } = useParams();
  const number = id && /^\d+$/.test(id) ? Number(id) : null;
  return (
    <Shell tab="brokerages">
      {number === null ? (
        <main className="k-page">
          <p className="k-quiet">There is no brokerage at this address.</p>
        </main>
      ) : (
        <Page key={number} id={number} />
      )}
    </Shell>
  );
}
