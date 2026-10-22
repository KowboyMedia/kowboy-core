// One record (design B2, images 07 to 09 and 17): its name and whether it is live, what Core knows
// of where it came from, its fields in Core's own names with links to the records they name, the
// text its websites get, exactly what its CRM sent, and the changes Core made to it. A removed
// record shows what its CRM last sent and until when Core keeps it. "Sync…" opens the sync window
// for this record alone. The CRM is named only as its code names itself.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { api, Refused, type RecordChange, type RecordField, type RecordPage } from './api';
import { Shell, useShell } from './Shell';
import { failureWords } from './failure';
import { CheckIcon, ChevronLeftIcon, CopyIcon, InfoCircleIcon, RefreshIcon } from './icons';
import { Badge } from './ui';
import { capital, factTime, fullDate } from './time';
import { crmOf, ID_WORD, recordPath } from './records';
import { SyncBanner, SyncWindow, useSync, type SyncTarget } from './sync';

type Tab = 'fields' | 'texts' | 'raw';

/** An address that names no record Core holds, or no longer holds. */
function NoRecord() {
  return (
    <main className="k-page">
      <Link className="k-back" to="/records">
        <ChevronLeftIcon size={16} />
        Records
      </Link>
      <p className="k-quiet">Core holds no record at this address.</p>
    </main>
  );
}

/** A value as the page shows it: "none" for nothing, JSON for a value with parts. */
function Value({ value }: { value: unknown }) {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  )
    return <span className="k-muted">none</span>;
  if (Array.isArray(value) && value.every((one) => typeof one !== 'object' || one === null))
    return <>{value.map((one) => String(one)).join(', ')}</>;
  if (typeof value === 'object') {
    const text = JSON.stringify(value, null, 2);
    return <pre className="k-json k-json-small">{text}</pre>;
  }
  return <>{String(value)}</>;
}

function FieldValue({ field }: { field: RecordField }) {
  if (field.links.length === 0) return <Value value={field.value} />;
  const named = new Set(field.links.map((link) => link.id));
  const ids = (Array.isArray(field.value) ? field.value : [field.value]).filter(
    (id): id is string => typeof id === 'string' && !named.has(id),
  );
  const parts: ReactNode[] = [
    ...field.links.map((link) => (
      <Link key={`${link.datatype} ${link.id}`} to={recordPath(link)}>
        {link.name}
      </Link>
    )),
    ...ids.map((id) => <span key={id}>{id}</span>),
  ];
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && ', '}
          {part}
        </span>
      ))}
    </>
  );
}

function Rows({ fields }: { fields: RecordField[] }) {
  if (fields.length === 0) return <p className="k-box-empty">Nothing here.</p>;
  return (
    <dl className="k-record-fields">
      {fields.map((field) => (
        <div key={field.key} className="k-record-field">
          <dt className="k-code">{field.key}</dt>
          <dd>
            <FieldValue field={field} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CopyJson({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="k-textlink k-copy-json"
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => undefined,
        );
      }}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {copied ? 'Copied' : 'Copy JSON'}
    </button>
  );
}

function Tabs({ page }: { page: RecordPage }) {
  const [tab, setTab] = useState<Tab>('fields');
  const raw = JSON.stringify(page.raw, null, 2);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'fields', label: 'Core fields' },
    { id: 'texts', label: 'Website text' },
    { id: 'raw', label: 'CRM data' },
  ];
  return (
    <section className="k-box k-record-tabs">
      <div className="k-tabbar" role="tablist" aria-label="What Core holds">
        {tabs.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            className={`k-tabbar-tab${tab === one.id ? ' k-tabbar-on' : ''}`}
            onClick={() => setTab(one.id)}
          >
            {one.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'fields' && (
          <>
            <p className="k-tab-help">
              Core’s own fields, named the same for every CRM. Links open the related records.
            </p>
            <Rows fields={page.fields} />
          </>
        )}
        {tab === 'texts' && (
          <>
            <p className="k-tab-help">
              The text websites get to show, prepared from Core’s fields by the rules (version{' '}
              {page.rulesVersion}).
            </p>
            <Rows fields={page.texts} />
          </>
        )}
        {tab === 'raw' && (
          <>
            <p className="k-tab-help k-tab-help-line">
              <span>Exactly what the CRM sent, as JSON.</span>
              <CopyJson text={raw} />
            </p>
            <pre className="k-json">{raw}</pre>
          </>
        )}
      </div>
    </section>
  );
}

function kindWords(change: RecordChange): string {
  const rules = change.rules ? ` · rules ${change.rules}` : '';
  if (change.kind === 'removed') return 'removed: the CRM no longer has it';
  if (change.kind === 'first') return `first written${rules}`;
  if (change.kind === 'recomputed') return `recomputed${rules}`;
  return `fetched from the CRM${rules}`;
}

function Changes({ page }: { page: RecordPage }) {
  const now = new Date(page.now);
  return (
    <section className="k-box">
      <header className="k-box-head">
        <h2>Changes</h2>
        <span className="k-muted k-small">Core keeps changes for {page.changeDays} days</span>
      </header>
      {page.changes.length === 0 && (
        <p className="k-box-empty">No changes in the last {page.changeDays} days.</p>
      )}
      {page.changes.map((change, index) => (
        <div key={`${change.at} ${String(index)}`} className="k-change">
          <p className="k-change-head">
            <strong>{factTime(change.at, now)}</strong>
            <span className="k-muted">{kindWords(change)}</span>
          </p>
          {change.fields.length > 0 && (
            <dl className="k-change-fields">
              {change.fields.map((field) => (
                <div key={field.key} className="k-change-field">
                  <dt className="k-code">{field.key}</dt>
                  <dd>
                    {field.from !== null && (
                      <>
                        <del>
                          <Value value={field.from} />
                        </del>{' '}
                        →{' '}
                      </>
                    )}
                    <Value value={field.to} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </section>
  );
}

function Facts({ page }: { page: RecordPage }) {
  const now = new Date(page.now);
  const facts: { label: string; value: ReactNode; code?: boolean }[] = [
    { label: ID_WORD, value: page.id, code: true },
    { label: 'Came through', value: page.connection.name },
    {
      label: 'Rules version',
      value:
        page.rulesVersion === page.currentRules
          ? page.rulesVersion
          : `${page.rulesVersion} (current ${page.currentRules})`,
    },
    {
      label: 'Last changed in the CRM',
      value: page.remoteUpdatedAt ? factTime(page.remoteUpdatedAt, now) : 'not given',
    },
    { label: 'Saved in Core', value: factTime(page.savedAt, now) },
    { label: 'Change number', value: Number(page.seq).toLocaleString('sv-SE') },
  ];
  return (
    <section className="k-box k-facts" aria-label="Facts">
      {facts.map((fact) => (
        <div key={fact.label} className="k-fact">
          <p className="k-fact-label">{fact.label}</p>
          <p className={`k-fact-value${fact.code ? ' k-code' : ''}`}>{fact.value}</p>
        </div>
      ))}
    </section>
  );
}

function RecordView({
  connection,
  datatype,
  id,
}: {
  connection: string;
  datatype: string;
  id: string;
}) {
  const { away } = useShell();
  const location = useLocation();
  const back = (location.state as { back?: string } | null)?.back ?? '';
  const [page, setPage] = useState<RecordPage | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'failed' | 'ok'>('loading');
  const [failure, setFailure] = useState('');
  const [syncing, setSyncing] = useState(false);
  const place = `record:${connection}/${datatype}/${id}`;

  const load = useCallback(() => {
    api.record(connection, datatype, id).then(
      (next) => {
        setPage(next);
        setState('ok');
      },
      (error: unknown) => {
        if (away(error)) return;
        if (error instanceof Refused && error.status === 404) {
          setState('missing');
          return;
        }
        setFailure(failureWords(error));
        setState((was) => (was === 'ok' ? was : 'failed'));
      },
    );
  }, [connection, datatype, id, away]);

  useEffect(() => load(), [load]);
  const sync = useSync(place, load);

  if (state === 'missing') return <NoRecord />;
  if (state === 'failed') {
    return (
      <main className="k-page">
        <p className="k-quiet">{failure} The page tries again when you reload it.</p>
      </main>
    );
  }
  if (!page) return null;

  const now = new Date(page.now);
  const crm = crmOf([page.connection.crm]);
  const target: SyncTarget = {
    chosen: `${page.name} (${page.datatype}, ${page.tenant.name})`,
    count: 1,
    choice: { records: [{ connection: page.connection.id, datatype: page.datatype, id: page.id }] },
    fetch: { kind: 'records', names: [page.name], types: [page.datatype] },
    crm,
    connections: [page.connection.name],
    sites: page.tenant.active ? page.tenant.sites : [],
    everyTenant: false,
    off: page.tenant.active ? [] : [page.tenant.name],
    rules: page.currentRules,
    place,
  };

  return (
    <main className="k-page">
      <Link className="k-back" to={`/records${back}`}>
        <ChevronLeftIcon size={16} />
        Records
      </Link>
      <div className="k-title-line">
        <h1 className="k-page-title k-page-title-large">{page.name}</h1>
        {page.removed ? <Badge tone="grey">Removed</Badge> : <Badge tone="green">Live</Badge>}
        <span className="k-row-buttons k-end">
          <button
            type="button"
            className="k-button k-button-quiet k-button-small"
            onClick={() => setSyncing(true)}
          >
            <RefreshIcon size={16} />
            Sync…
          </button>
        </span>
      </div>
      <p className="k-page-sub k-record-line">
        {[capital(page.datatype), page.tenant.name, page.offices.join(', ')]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <SyncBanner kept={sync.kept} view={sync.view} />
      {page.removed && (
        <section className="k-banner k-banner-grey" aria-label="Removed">
          <InfoCircleIcon size={20} />
          <div>
            <p className="k-banner-title">
              Removed {page.removedAt ? factTime(page.removedAt, now) : ''}
            </p>
            <p className="k-banner-text">
              The CRM no longer has this {page.datatype}. Core keeps it, marked as removed
              {page.keptUntil ? `, until ${fullDate(page.keptUntil)}` : ''} so that every website
              learns it is gone; then Core deletes it for good.
            </p>
          </div>
        </section>
      )}
      <Facts page={page} />
      <Tabs page={page} />
      <Changes page={page} />
      {syncing && (
        <SyncWindow
          target={target}
          onClose={() => setSyncing(false)}
          onStarted={(kept) => {
            setSyncing(false);
            sync.start(kept);
          }}
        />
      )}
    </main>
  );
}

/** `/admin/records/<connection>/<datatype>/<id>`. */
export function RecordPagePage() {
  const { connection, datatype, id } = useParams();
  return (
    <Shell tab="records">
      {connection && datatype && id ? (
        <RecordView
          key={`${connection}/${datatype}/${id}`}
          connection={connection}
          datatype={datatype}
          id={id}
        />
      ) : (
        <NoRecord />
      )}
    </Shell>
  );
}
