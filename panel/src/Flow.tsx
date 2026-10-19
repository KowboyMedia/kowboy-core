// The Flow (the tenant mockups, images 22 to 27): maintenance at the top, then what the CRMs have
// listed for Core to fetch, from queued to written in Core and fetched by the websites, the newest
// 100, read again every second. The reasons and the errors are the CRMs' code's own words; the
// page names no CRM.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type Flow, type FlowRow, type FlowSite } from './api';
import { Shell, useShell } from './Shell';
import { failureWords } from './failure';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  ClockIcon,
  LoaderIcon,
  PauseIcon,
  PowerIcon,
  TrafficConeIcon,
  XIcon,
} from './icons';
import { capital, exactly, when } from './time';
import { Modal, Switch, useNote } from './ui';

const EVERY_MS = 1_000;

// ---- Maintenance ------------------------------------------------------------------------------------

/** "Turn on maintenance?" (image 24). */
function MaintenanceWindow({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { away } = useShell();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const on = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await api.maintenance(true);
      onDone();
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Turn on maintenance?"
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
            onClick={() => void on()}
          >
            {busy ? <LoaderIcon className="k-spin" size={18} /> : <TrafficConeIcon size={18} />}
            Turn on maintenance
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        Websites aren’t told about changes; the notices go out together when you turn it off. No
        queued job starts. Core keeps reading the CRMs, and visitors’ forms still reach them.
      </p>
      {failed && <p className="k-error">{failed}</p>}
    </Modal>
  );
}

/** The Maintenance box (images 22 and 25): off, or on since when and by whom. */
function MaintenanceBox({ flow, onChanged }: { flow: Flow; onChanged: () => void }) {
  const { away } = useShell();
  const note = useNote();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const { on, since, by } = flow.maintenance;
  const now = new Date(flow.now);
  const off = async () => {
    setBusy(true);
    try {
      await api.maintenance(false);
      note({ text: 'Maintenance is off. Held changes are going out to the websites.' });
      onChanged();
    } catch (error) {
      if (!away(error)) note({ text: failureWords(error), icon: 'warn' });
    }
    setBusy(false);
  };
  return (
    <section className={`k-box${on ? ' k-box-on' : ''}`} aria-label="Maintenance">
      <header className="k-box-head">
        <h2>
          {on && <TrafficConeIcon size={18} />}
          {on ? 'Maintenance is on' : 'Maintenance'}
        </h2>
      </header>
      <div className="k-box-body k-maintenance">
        <Switch
          on={on}
          label={on ? 'On' : 'Off'}
          strong
          disabled={busy}
          onChange={(next) => (next ? setAsking(true) : void off())}
        />
        <div>
          {on && since && (
            <p className="k-maintenance-since">
              Since {when(since, now)}
              {by ? `, by ${by}` : ''}.
            </p>
          )}
          <p className="k-maintenance-text">
            For the developers, before work on Core such as a database restore. While it is on,
            websites get no change notices and no queued job starts; the held notices go out
            together when it is switched off. Core keeps reading the CRMs, and visitors’ forms still
            go.
          </p>
        </div>
      </div>
      {asking && (
        <MaintenanceWindow
          onClose={() => setAsking(false)}
          onDone={() => {
            setAsking(false);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

// ---- The filters ----------------------------------------------------------------------------------

type Option = { key: string; name: string };

/** A list to pick several from (B2's filters): the picked ones as chips, the rest in a menu. */
function Picker({
  id,
  label,
  all,
  options,
  chosen,
  onChange,
}: {
  id: string;
  label: string;
  /** What an empty filter reads as: "All tenants". */
  all: string;
  options: Option[];
  chosen: string[];
  onChange: (chosen: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const picked = options.filter((option) => chosen.includes(option.key));
  const toggle = (key: string) =>
    onChange(chosen.includes(key) ? chosen.filter((one) => one !== key) : [...chosen, key]);
  return (
    <div className="k-field k-field-first" ref={holder}>
      <span className="k-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="k-picker">
        <button
          type="button"
          className="k-picker-box"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label`}
          onClick={() => setOpen(!open)}
        >
          {picked.length === 0 && <span className="k-picker-all">{all}</span>}
          <ChevronDownIcon className="k-picker-chevron" size={16} />
        </button>
        {picked.length > 0 && (
          <span className="k-picker-chips">
            {picked.map((option) => (
              <span key={option.key} className="k-chip">
                {option.name}
                <button
                  type="button"
                  aria-label={`Remove ${option.name}`}
                  onClick={() => toggle(option.key)}
                >
                  <XIcon size={12} />
                </button>
              </span>
            ))}
          </span>
        )}
        {open && (
          <ul className="k-menu k-picker-menu" role="listbox" aria-multiselectable="true">
            {options.map((option) => {
              const on = chosen.includes(option.key);
              return (
                <li key={option.key} role="option" aria-selected={on}>
                  <button type="button" className="k-menu-item" onClick={() => toggle(option.key)}>
                    <span className="k-picker-tick">{on && <CheckIcon size={14} />}</span>
                    {option.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- The list -------------------------------------------------------------------------------------

/** "Property", "Agent": a record's type beside its name. */
const typeWord = (datatype: FlowRow['datatype']): string => capital(datatype);

function InCore({ row, now }: { row: FlowRow; now: Date }) {
  if (row.state === 'written') {
    return (
      <span className="k-flow-state k-flow-good">
        <CircleCheckIcon size={16} />
        Written {row.writtenAt ? exactly(row.writtenAt, now) : ''}
      </span>
    );
  }
  if (row.state === 'waiting') {
    return (
      <span className="k-flow-state k-flow-wait">
        <ClockIcon size={16} />
        Waiting
      </span>
    );
  }
  const failed = row.state === 'failed';
  return (
    <>
      <span className="k-flow-state k-flow-bad">
        <AlertCircleIcon size={16} />
        {failed
          ? row.attempts === 1
            ? 'Failed once'
            : `Failed ${String(row.attempts)} times`
          : 'Given up'}
      </span>
      <span className="k-flow-sub">
        {failed
          ? row.nextAt
            ? `next try ${exactly(row.nextAt, now)}`
            : ''
          : `after ${String(row.attempts)} ${row.attempts === 1 ? 'try' : 'tries'}`}
      </span>
    </>
  );
}

const SITE_ICON: Record<FlowSite['state'], ReactNode> = {
  fetched: <CircleCheckIcon size={16} />,
  waiting: <ClockIcon size={16} />,
  held: <PauseIcon size={16} />,
  off: <PowerIcon size={16} />,
};

function Sites({ sites, now }: { sites: FlowSite[]; now: Date }) {
  // While maintenance holds the notices, every website waits alike: one line says so.
  const held = sites.some((site) => site.state === 'held');
  const shown = held ? sites.filter((site) => site.state !== 'held') : sites;
  return (
    <>
      {held && (
        <span className="k-flow-site">
          <span className="k-flow-state k-flow-held">
            {SITE_ICON.held}
            Held
          </span>
          <span className="k-flow-sub">until maintenance is off</span>
        </span>
      )}
      {shown.map((site, index) => (
        <span key={`${site.label} ${String(index)}`} className="k-flow-site">
          <span className={`k-flow-state k-flow-site-${site.state}`}>
            {SITE_ICON[site.state]}
            {site.label}
          </span>
          <span className="k-flow-sub">
            {site.state === 'fetched'
              ? `fetched ${site.at ? exactly(site.at, now) : ''}`
              : site.state === 'off'
                ? 'tenant switched off'
                : 'not fetched yet'}
          </span>
        </span>
      ))}
    </>
  );
}

function Row({ row, now }: { row: FlowRow; now: Date }) {
  const error = row.state !== 'written' && row.state !== 'waiting' ? row.lastError : null;
  return (
    <>
      <tr className={error ? 'k-flow-has-error' : undefined}>
        <td className="k-flow-time">{row.queuedAt ? exactly(row.queuedAt, now) : ''}</td>
        <td>
          <span className={row.name ? 'k-strong' : 'k-flow-id'}>{row.name ?? row.id}</span>{' '}
          <span className="k-flow-type">{typeWord(row.datatype)}</span>
          <span className="k-flow-sub">
            {[row.tenant.name, row.office].filter(Boolean).join(' · ')}
          </span>
        </td>
        <td className="k-muted">{row.why ?? ''}</td>
        <td>
          <InCore row={row} now={now} />
        </td>
        <td>{row.state === 'written' && <Sites sites={row.sites} now={now} />}</td>
      </tr>
      {error && (
        <tr className="k-flow-error-row">
          <td />
          <td colSpan={4}>
            <p className="k-flow-error">
              <AlertTriangleIcon size={16} />
              <span>
                <strong>Last error:</strong> {error}
              </span>
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

function List({ flow, failed }: { flow: Flow; failed: string | null }) {
  const now = new Date(flow.now);
  return (
    <section className="k-box k-flow">
      <header className="k-box-head">
        <p className="k-flow-counts">
          <strong>{flow.waiting}</strong> waiting to be fetched ·{' '}
          <strong className={flow.failed > 0 ? 'k-bad' : undefined}>{flow.failed}</strong> failed
        </p>
        {failed ? (
          <span className="k-error k-flow-live">{failed}</span>
        ) : (
          <span className="k-flow-live">
            <span className="k-dot" aria-hidden="true" />
            Live, updated every second
          </span>
        )}
      </header>
      {flow.rows.length === 0 ? (
        <p className="k-box-empty">Nothing queued or written yet.</p>
      ) : (
        <div className="k-flow-scroll">
          <table className="k-table k-flow-table">
            <thead>
              <tr>
                <th>Queued</th>
                <th>Record</th>
                <th>Why</th>
                <th>In Core</th>
                <th>Website</th>
              </tr>
            </thead>
            <tbody>
              {flow.rows.map((row) => (
                <Row key={row.key} row={row} now={now} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="k-flow-foot">The newest 100, by queued time</p>
    </section>
  );
}

// ---- The page -------------------------------------------------------------------------------------

function FlowView() {
  const { away, setMaintenance } = useShell();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tenants, setTenants] = useState<string[]>([]);
  const [offices, setOffices] = useState<string[]>([]);
  /** One read at a time: a slow answer is not asked again before it comes. */
  const reading = useRef(false);
  /** The filters of the newest read, so an answer for older filters is not shown. */
  const asked = useRef('');

  const read = useCallback(() => {
    const filters = JSON.stringify([tenants, offices]);
    if (reading.current && asked.current === filters) return;
    reading.current = true;
    asked.current = filters;
    api.flow(tenants.map(Number), offices).then(
      (next) => {
        reading.current = false;
        if (asked.current !== filters) return;
        setFlow(next);
        setMaintenance(next.maintenance.on);
        setFailed(null);
      },
      (error: unknown) => {
        reading.current = false;
        if (!away(error)) setFailed(failureWords(error));
      },
    );
  }, [tenants, offices, away, setMaintenance]);

  useEffect(() => {
    read();
    const timer = setInterval(read, EVERY_MS);
    return () => clearInterval(timer);
  }, [read]);

  const tenantOptions = (flow?.tenants ?? []).map((tenant) => ({
    key: String(tenant.id),
    name: tenant.name,
  }));
  const officeOptions = (flow?.offices ?? [])
    .filter((office) => tenants.length === 0 || tenants.includes(String(office.tenant)))
    .map((office) => ({ key: office.key, name: office.name }));
  const filtered = tenants.length > 0 || offices.length > 0;

  return (
    <main className="k-page">
      <h1 className="k-page-title">Flow</h1>
      <p className="k-page-sub">
        What the CRMs have listed for Core to fetch, from queued to written in Core and fetched by
        the websites. The newest 100 by queued time, updated every second.
      </p>
      {!flow && failed && (
        <p className="k-quiet" role="status">
          {failed} The page tries again by itself.
        </p>
      )}
      {flow && (
        <>
          <MaintenanceBox flow={flow} onChanged={read} />
          <section className="k-box" aria-label="Filters">
            <div className="k-box-body">
              <div className="k-pair">
                <Picker
                  id="flow-tenants"
                  label="Tenants"
                  all="All tenants"
                  options={tenantOptions}
                  chosen={tenants}
                  onChange={(next) => {
                    setTenants(next);
                    // An office of a tenant no longer chosen leaves the filter with it.
                    const kept = new Set(
                      flow.offices
                        .filter(
                          (office) => next.length === 0 || next.includes(String(office.tenant)),
                        )
                        .map((office) => office.key),
                    );
                    setOffices((was) => was.filter((key) => kept.has(key)));
                  }}
                />
                <Picker
                  id="flow-offices"
                  label="Offices"
                  all="All offices"
                  options={officeOptions}
                  chosen={offices}
                  onChange={setOffices}
                />
              </div>
              <p className="k-help k-filter-help">
                An empty filter means all.
                {filtered && (
                  <button
                    type="button"
                    className="k-textlink k-filter-clear"
                    onClick={() => {
                      setTenants([]);
                      setOffices([]);
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </p>
            </div>
          </section>
          <List flow={flow} failed={failed} />
        </>
      )}
    </main>
  );
}

/** `/admin/flow`. */
export function FlowPage() {
  return (
    <Shell tab="flow">
      <FlowView />
    </Shell>
  );
}
