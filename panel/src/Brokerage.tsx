// One tenant's page (design B, images 11, 12 and 24 to 38, as the tenant mockups 02, 03 and 11 to
// 16 change it): its websites and its CRM connections, each with an Edit and a Delete icon, its
// tenant token and its switch, and the windows that confirm a delete. A connection's card says
// what its CRM's code says of it and opens the code's own sections; the page names no CRM of its
// own. The page updates by itself, so a website's new token and a delete reaching the websites
// show without a reload.
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, type Brokerage, type ConnectionView, type ReloadView, type Website } from './api';
import { Shell, useShell, type Arrival } from './Shell';
import { StatusBadge } from './Brokerages';
import { failureWords } from './failure';
import { Badge, IconButton, Modal, Switch, useNote, ValueField, type Tone } from './ui';
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  RefreshIcon,
  TrashIcon,
} from './icons';
import { clock, counted, listed, when } from './time';
import { loadedList, records } from './records';
import { clientLine, platformOf, platformWords } from './websites';
import { AddCrmWindow } from './connect';
import { ConnectionSections } from './sections';
import { idOf, Nothing, useTenant } from './tenant';

/** "a, b and c" for pieces of a sentence that are not plain text. */
function joined(parts: ReactNode[]): ReactNode {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (index === parts.length - 1 ? ' and ' : ', ')}
      {part}
    </Fragment>
  ));
}

/** The CRMs a tenant's connections are with, by their names, for a sentence. */
function crmWords(page: Brokerage, last = 'and'): string {
  const names = [...new Set(page.connections.map((connection) => connection.crm))];
  if (names.length === 0 && page.crms[0]) names.push(page.crms[0].name);
  return listed(names, last);
}

/** "12 properties, 3 agents and the office Testkontoret": what a connection holds, in a sentence. */
function holding(connection: ConnectionView): string[] {
  const what = loadedList(connection.counts);
  const offices = connection.offices;
  if (offices.length > 0) {
    what.push(`the office${offices.length === 1 ? '' : 's'} ${listed(offices)}`);
  }
  return what;
}

/** The word on the line that opens a connection's own sections: Core's name for its offices. */
const OFFICES = 'Offices';

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
  onDelete,
}: {
  page: Brokerage;
  switched: Set<number>;
  onDelete: (website: Website) => void;
}) {
  const now = new Date(page.now);
  const base = `/brokerages/${String(page.id)}/websites`;
  return (
    <section className="k-box">
      <header className="k-box-head">
        <h2>Websites</h2>
        <Link className="k-button k-button-quiet k-button-small" to={`${base}/new`}>
          <PlusIcon size={16} />
          Add website
        </Link>
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
                <IconButton label="Edit website" to={`${base}/${String(website.id)}`}>
                  <PencilIcon size={16} />
                </IconButton>
                <IconButton label="Delete website" danger onClick={() => onDelete(website)}>
                  <TrashIcon size={16} />
                </IconButton>
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** "Delete lindqvistholm.se?" (image 11). */
function DeleteWebsiteWindow({
  website,
  onClose,
  onDeleted,
}: {
  website: Website;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { away } = useShell();
  const note = useNote();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const remove = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await api.removeWebsite(website.id);
      note({ text: `${website.label} deleted.` });
      onDeleted();
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Delete ${website.label}?`}
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
            Delete website
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        Core stops telling it about changes and deletes its history. A website that is shut down
        needs nothing more; one still running keeps its last copy and could still fetch data with
        the tenant token. To stop serving a tenant that has left, switch the tenant off instead.
      </p>
      {failed && <p className="k-error">{failed}</p>}
    </Modal>
  );
}

// ---- CRM connections ----------------------------------------------------------------------------

const CONNECTION_STATUS: Record<ConnectionView['status'], { words: string; tone: Tone }> = {
  ok: { words: 'OK', tone: 'green' },
  look: { words: 'Needs a look', tone: 'orange' },
};

function ConnectionRow({
  page,
  connection,
  onDelete,
  onActed,
}: {
  page: Brokerage;
  connection: ConnectionView;
  onDelete: () => void;
  onActed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date(page.now);
  const status = page.active
    ? CONNECTION_STATUS[connection.status]
    : { words: 'Off', tone: 'grey' as const };
  const opens = connection.sections.length > 0 || connection.sectionsFailed !== null;
  const offices = `${OFFICES}: ${connection.offices.length > 0 ? connection.offices.join(', ') : 'none yet'}`;
  const line = [connection.describe, records(connection.counts.property, 'property')]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="k-row k-row-stack">
      <div className="k-row-top">
        <div className="k-row-main">
          <div className="k-row-name">
            {connection.name}
            {page.active && connection.formsTestMode && (
              <span className="k-tag k-tag-beside">Forms test mode</span>
            )}
          </div>
          <div className="k-row-sub">{line}</div>
        </div>
        <div className="k-row-end">
          <Badge tone={status.tone}>{status.words}</Badge>
          <span className="k-row-buttons">
            <IconButton
              label="Edit connection"
              to={`/brokerages/${String(page.id)}/connections/${encodeURIComponent(connection.id)}`}
            >
              <PencilIcon size={16} />
            </IconButton>
            <IconButton label="Delete connection" danger onClick={onDelete}>
              <TrashIcon size={16} />
            </IconButton>
          </span>
        </div>
      </div>
      {page.active && connection.formsTestMode && (
        <p className="k-warning">
          <AlertTriangleIcon size={16} />
          <span>
            {connection.formsTestModeSince
              ? `On since ${when(connection.formsTestModeSince, now)}. `
              : 'On. '}
            Forms stop in Core and never reach {connection.crm}; the website is told “not sent”.
            Nothing is sent later.
          </span>
        </p>
      )}
      <div className="k-row-bottom">
        {opens ? (
          <button
            type="button"
            className="k-opener"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
            {offices}
          </button>
        ) : (
          <span className="k-row-sub">{offices}</span>
        )}
        {!page.active && <span className="k-row-sub">Forms: refused (tenant off)</span>}
      </div>
      {open && opens && (
        <ConnectionSections connection={connection} opener={OFFICES} now={now} onDone={onActed} />
      )}
    </div>
  );
}

function CrmsCard({
  page,
  onAdd,
  onDelete,
  onActed,
}: {
  page: Brokerage;
  onAdd: () => void;
  onDelete: (connection: ConnectionView) => void;
  onActed: () => void;
}) {
  return (
    <section className="k-box">
      <header className="k-box-head">
        <h2>CRMs</h2>
        <button type="button" className="k-button k-button-quiet k-button-small" onClick={onAdd}>
          <PlusIcon size={16} />
          Add CRM
        </button>
      </header>
      {page.connections.length === 0 && (
        <p className="k-box-empty">No CRM connection yet. Add one with “Add CRM”.</p>
      )}
      {page.connections.map((connection) => (
        <ConnectionRow
          key={connection.id}
          page={page}
          connection={connection}
          onDelete={() => onDelete(connection)}
          onActed={onActed}
        />
      ))}
    </section>
  );
}

/** "Delete “<connection>”?" (image 13): what leaves the websites, and what is deleted. */
function DeleteConnectionWindow({
  page,
  connection,
  onClose,
  onDeleted,
}: {
  page: Brokerage;
  connection: ConnectionView;
  onClose: () => void;
  onDeleted: (deletedAt: string) => void;
}) {
  const { away } = useShell();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const sites = page.websites.map((website) => website.label);
  const what = holding(connection);
  const leaving =
    what.length === 0
      ? 'It holds no records yet.'
      : sites.length === 0
        ? `Its ${listed(what)} leave Core.`
        : `Its ${listed(what)} leave ${listed(sites)} at ${sites.length === 1 ? 'its' : 'their'} next fetch.`;
  const remove = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const { removedAt } = await api.removeConnection(connection.id);
      onDeleted(removedAt);
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Delete “${connection.name}”?`}
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
            Delete connection
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        {leaving} Its saved login and its form history are deleted, and Core stops reading{' '}
        {connection.crm} for {page.name}. This can’t be undone.
      </p>
      {failed && <p className="k-error">{failed}</p>}
    </Modal>
  );
}

// ---- The tenant itself ----------------------------------------------------------------------------

/** "Delete Hjortronet Fastighetsbyrå?" (image 15): everything that goes, confirmed by its name. */
function DeleteTenantWindow({ page, onClose }: { page: Brokerage; onClose: () => void }) {
  const { away } = useShell();
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const sites = page.websites.map((website) => website.label);
  const held = page.connections.reduce(
    (sum, connection) =>
      sum + Object.values(connection.counts).reduce((all, count) => all + count, 0),
    0,
  );
  const matches = typed.trim() !== '' && typed.trim() === page.name.trim();
  const after =
    sites.length === 0
      ? ''
      : sites.length === 1
        ? `${sites[0] ?? ''} stops updating and keeps what it shows until its own admin removes it. `
        : `${listed(sites)} stop updating and keep what they show until their own admins remove them. `;
  const remove = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await api.deleteBrokerage(page.id, typed.trim());
      const arrival: Arrival = { note: `Deleted ${page.name} and everything of it.` };
      navigate('/brokerages', { state: arrival });
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Delete ${page.name}?`}
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
            disabled={busy || !matches}
            onClick={() => void remove()}
          >
            <TrashIcon size={18} />
            Delete tenant
          </button>
        </>
      }
    >
      <p className="k-modal-text">Core deletes everything of {page.name}:</p>
      <ul className="k-modal-list">
        {page.websites.map((website) => (
          <li key={website.id}>
            <strong>{website.label}</strong>: it can no longer fetch from Core
          </li>
        ))}
        {page.connections.map((connection) => (
          <li key={connection.id}>
            the {connection.crm} connection <strong>{connection.name}</strong> and its saved login
          </li>
        ))}
        {held > 0 && (
          <li>
            its <strong>{counted(held, 'record', 'records')}</strong>: properties, projects, agents,
            offices, areas and associations
          </li>
        )}
        <li>the forms Core holds for it, and its problems in the Inbox</li>
      </ul>
      <p className="k-modal-text">
        {after}This can’t be undone. To stop serving a tenant for now, switch it off instead.
      </p>
      <div className="k-field">
        <label className="k-label" htmlFor="delete-name">
          Type the tenant’s name to delete it
        </label>
        <input
          id="delete-name"
          className="k-input"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matches && !busy) void remove();
          }}
        />
      </div>
      {failed && <p className="k-error">{failed}</p>}
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
            Core keeps no copy of this tenant’s token. Replacing it makes one you can copy.
          </p>
        )}
        <p className="k-help">
          The secret key all of this tenant’s websites use to fetch data and send forms.
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
  const [failed, setFailed] = useState<string | null>(null);
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
    setFailed(null);
    try {
      const { token } = await api.replaceToken(page.id);
      onReplaced(token);
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
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
      {failed && <p className="k-error">{failed}</p>}
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
  const [failed, setFailed] = useState<string | null>(null);
  const crms = page.connections.length > 0 ? crmWords(page) : '';
  const sites = page.websites.map((website) => website.label);
  const fetch = crms
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
    !page.active && sites.length > 0 ? 'They reload once the tenant is switched on. ' : '';
  const go = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await api.reload(page.id);
      onDone();
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
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
      {failed && <p className="k-error">{failed}</p>}
    </Modal>
  );
}

/** "<CRM> no longer lists 1 property, so Core removed it: Kopparbergsvägen 8, Västerås." */
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
    return `${from} no longer lists ${String(reload.removedCount)} records, so Core removed them, among them ${names.join(', ')}.`;
  }
  const types = [...new Set(reload.removed.map((one) => one.datatype))].map((datatype) =>
    records(reload.removed.filter((one) => one.datatype === datatype).length, datatype),
  );
  const them = reload.removedCount === 1 ? 'it' : 'them';
  return `${from} no longer lists ${listed(types)}, so Core removed ${them}: ${listed(names)}.`;
}

/** How long the page says a reload is done. */
const DONE_SHOWN_MS = 60 * 60_000;

/** A reload under way, or done (image 40), at the top of the page. */
function ReloadBanner({ page }: { page: Brokerage }) {
  const reload = page.reload;
  if (!reload) return null;
  const crms = crmWords(page) || 'the CRM';
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
      className={`k-banner ${reload.failure !== null ? 'k-banner-warn' : 'k-banner-done'}`}
      aria-label="Reload all data"
    >
      {reload.failure !== null ? <AlertTriangleIcon size={20} /> : <CircleCheckIcon size={20} />}
      <div>
        <p className="k-banner-title">
          {reload.failure !== null ? 'Reload done in part' : 'Reload done'} ({clock(reload.doneAt)})
        </p>
        <p className="k-banner-text">
          {reload.failure !== null &&
            `Core couldn’t fetch everything from ${crms} again, and the error said “${reload.failure}”. Some records may still be missing or out of date: try again in a while, and if it fails again, pass these words on to Core’s developers. `}
          {removedWords(reload, crms)}
          {sites}
        </p>
      </div>
    </section>
  );
}

// ---- The tenant's switch ----------------------------------------------------------------------------

function TenantCard({
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
        <h2>Tenant</h2>
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
          Reload: if a website shows something {crmWords(page, 'or')} no longer has.
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
  const [failed, setFailed] = useState<string | null>(null);
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
    setFailed(null);
    try {
      await api.switchBrokerage(page.id, false);
      note({ text: `${page.name} is switched off.`, icon: 'off' });
      onDone();
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
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
      {failed && <p className="k-error">{failed}</p>}
    </Modal>
  );
}

// ---- The page ---------------------------------------------------------------------------------------

type Open =
  | { kind: 'delete-website'; website: Website }
  | { kind: 'add-crm' }
  | { kind: 'delete-connection'; connection: ConnectionView }
  | { kind: 'delete-tenant' }
  | { kind: 'replace-token' }
  | { kind: 'token-replaced'; token: string }
  | { kind: 'switch-off' }
  | { kind: 'reload' }
  | null;

/** A connection just deleted, until every website it was on has fetched since. */
type Deleted = {
  name: string;
  what: string[];
  at: number;
  sites: number[];
};

function Page({ id }: { id: number }) {
  const { away } = useShell();
  const note = useNote();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Open>(null);
  const [switched, setSwitched] = useState<Set<number>>(new Set());
  const [deleted, setDeleted] = useState<Deleted | null>(null);
  /** A token replaced from this page: armed, then waiting until every website uses it. */
  const [watching, setWatching] = useState<'armed' | 'waiting' | null>(null);
  /** A reload under way, followed until every website has reloaded. */
  const [reloading, setReloading] = useState(false);
  const fast =
    open?.kind === 'token-replaced' || deleted !== null || watching !== null || reloading;
  const { page, state, failure, load } = useTenant(id, fast);
  const before = useRef<Brokerage | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const closeAndLoad = useCallback(() => {
    setOpen(null);
    void load();
  }, [load]);

  useEffect(() => {
    setReloading(
      page?.reload !== null && page?.reload !== undefined && page.reload.state !== 'done',
    );
  }, [page]);

  // What changed since the last read: websites that took the new token, a delete that reached
  // every website.
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
    if (deleted) {
      const sites = page.websites.filter((website) => deleted.sites.includes(website.id));
      const fetched = sites.every(
        (website) => website.lastFetchAt !== null && Date.parse(website.lastFetchAt) > deleted.at,
      );
      if (sites.length === 0 || fetched) {
        setDeleted(null);
        const last = sites
          .map((website) => website.lastFetchAt ?? '')
          .sort()
          .at(-1);
        note({
          text:
            sites.length > 0 && deleted.what.length > 0 && last
              ? `Deleted “${deleted.name}”. Its ${listed(deleted.what)} left ${listed(sites.map((site) => site.label))} at ${when(last, new Date(page.now))}.`
              : `Deleted “${deleted.name}”.`,
        });
      }
    }
  }, [page, watching, deleted, note]);

  if (state === 'missing') return <Nothing />;
  if (state === 'failed') {
    return (
      <main className="k-page">
        <p className="k-quiet">{failure} The page tries again by itself.</p>
      </main>
    );
  }
  if (!page) return null;

  const switchOn = async () => {
    try {
      await api.switchBrokerage(page.id, true);
      note({ text: `${page.name} is switched on. Its websites fetch what changed meanwhile.` });
      void load();
    } catch (error) {
      if (!away(error)) note({ text: failureWords(error), icon: 'warn' });
    }
  };

  const connectionDeleted = (connection: ConnectionView, deletedAt: string) => {
    const sites = page.active ? page.websites.map((website) => website.id) : [];
    setOpen(null);
    if (sites.length === 0) {
      note({ text: `Deleted “${connection.name}”.` });
    } else {
      note({
        text: `Deleted “${connection.name}”. Waiting for ${listed(page.websites.map((website) => website.label))} to fetch the change.`,
      });
      setDeleted({
        name: connection.name,
        what: holding(connection),
        at: Date.parse(deletedAt),
        sites,
      });
    }
    void load();
  };

  return (
    <main className="k-page">
      <Link className="k-back" to="/brokerages">
        <ChevronLeftIcon size={16} />
        Tenants
      </Link>
      <div className="k-title-line">
        <h1 className="k-page-title k-page-title-large">{page.name}</h1>
        <StatusBadge status={page.status} />
        <span className="k-row-buttons k-end">
          <IconButton label="Edit tenant" to={`/brokerages/${String(page.id)}/edit`}>
            <PencilIcon size={16} />
          </IconButton>
          <IconButton
            label="Delete tenant"
            danger
            onClick={() => setOpen({ kind: 'delete-tenant' })}
          >
            <TrashIcon size={16} />
          </IconButton>
        </span>
      </div>
      <ReloadBanner page={page} />

      <WebsitesCard
        page={page}
        switched={switched}
        onDelete={(website) => setOpen({ kind: 'delete-website', website })}
      />
      <CrmsCard
        page={page}
        onAdd={() => setOpen({ kind: 'add-crm' })}
        onDelete={(connection) => setOpen({ kind: 'delete-connection', connection })}
        onActed={() => void load()}
      />
      <TokenCard page={page} onReplace={() => setOpen({ kind: 'replace-token' })} />
      <TenantCard
        page={page}
        onSwitch={(on) => (on ? void switchOn() : setOpen({ kind: 'switch-off' }))}
        onReload={() => setOpen({ kind: 'reload' })}
      />

      {open?.kind === 'delete-website' && (
        <DeleteWebsiteWindow website={open.website} onClose={close} onDeleted={closeAndLoad} />
      )}
      {open?.kind === 'add-crm' && (
        <AddCrmWindow
          tenant={page.name}
          crms={page.crms}
          onClose={close}
          onChosen={(provider) =>
            navigate(
              `/brokerages/${String(page.id)}/crms/new?provider=${encodeURIComponent(provider)}`,
            )
          }
        />
      )}
      {open?.kind === 'delete-connection' && (
        <DeleteConnectionWindow
          page={page}
          connection={open.connection}
          onClose={close}
          onDeleted={(deletedAt) => connectionDeleted(open.connection, deletedAt)}
        />
      )}
      {open?.kind === 'delete-tenant' && <DeleteTenantWindow page={page} onClose={close} />}
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
  const number = idOf(id);
  return (
    <Shell tab="brokerages">
      {number === null ? <Nothing /> : <Page key={number} id={number} />}
    </Shell>
  );
}
