// Records (design B2, images 01 to 06, 10 to 16, 19 to 37): every record Core holds, by name, with
// filters by tenant, office, type and the CRM's id, each choice counted; a record opens its page;
// records picked here, or everything the filters keep, are synced in a window, and a banner follows
// the sync. The filters live in the address, so the way back from a record keeps them. A CRM is
// named only as its code names itself.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { api, recordQuery, type RecordFilter, type RecordList, type RecordRow } from './api';
import { Shell, useShell } from './Shell';
import { failureWords } from './failure';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderIcon,
  RefreshIcon,
  SearchIcon,
  XIcon,
} from './icons';
import { Picker } from './picker';
import { Badge, Loading, Switch, useNote } from './ui';
import { capital, counted, listed, listTime } from './time';
import { pluralOf, SyncBanner, SyncWindow, useSync, type SyncTarget } from './sync';
import { crmOf, idWord, recordPath } from './records';

type Datatype = RecordRow['datatype'];

const TYPES: Datatype[] = ['property', 'project', 'agent', 'office', 'area', 'association'];

/** The most records one sync takes when they are picked. */
const MOST_PICKED = 500;

function filterOf(query: URLSearchParams): RecordFilter {
  return {
    tenants: query
      .getAll('tenant')
      .filter((one) => /^\d+$/.test(one))
      .map(Number),
    offices: query.getAll('office').filter((one) => one.includes(':')),
    types: query.getAll('type').filter((one): one is Datatype => TYPES.includes(one as Datatype)),
    id: (query.get('id') ?? '').trim(),
    removed: query.get('removed') === '1',
  };
}

const rowKey = (row: { connection: string; datatype: string; id: string }): string =>
  `${row.connection} ${row.datatype} ${row.id}`;

/** The page numbers to show: the first, the last, and two either side of this one. */
function pageNumbers(page: number, pages: number): (number | null)[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  return shown.flatMap((n, index) => {
    const before = shown[index - 1];
    return before !== undefined && n - before > 1 ? [null, n] : [n];
  });
}

/** "Kopparbergsvägen 8 (property, Mäklarbyrån Ljungström)", "a, b, c and 7 more (agents, …)". */
function pickedWords(rows: RecordRow[]): string {
  const names = rows.map((row) => row.name);
  const shown =
    names.length > 3
      ? `${names.slice(0, 3).join(', ')} and ${String(names.length - 3)} more`
      : names.join(', ');
  const types = [...new Set(rows.map((row) => row.datatype))];
  const typeWords = rows.length === 1 && types[0] ? types[0] : pluralOf(types);
  const tenants = listed([...new Set(rows.map((row) => row.tenant.name))]);
  return `${shown} (${typeWords}, ${tenants})`;
}

/** What a sync of the picked records, or of everything the filters keep, chooses. */
export function targetOf(
  list: RecordList,
  filter: RecordFilter,
  picked: RecordRow[],
  place = 'records',
): SyncTarget {
  const crms = list.crms;
  const crm = crmOf(crms);
  const tenantsOf = (ids: number[]) =>
    list.tenants.filter((tenant) => ids.length === 0 || ids.includes(tenant.id));
  if (picked.length > 0) {
    const tenants = tenantsOf([...new Set(picked.map((row) => row.tenant.id))]);
    const connections = tenants
      .flatMap((tenant) => tenant.connections)
      .filter((connection) => picked.some((row) => row.connection === connection.id));
    return {
      chosen: pickedWords(picked),
      count: picked.length,
      choice: {
        records: picked.map((row) => ({
          connection: row.connection,
          datatype: row.datatype,
          id: row.id,
        })),
      },
      fetch: {
        kind: 'records',
        names: picked.length <= 3 ? picked.map((row) => row.name) : [],
        types: picked.map((row) => row.datatype),
      },
      crm: crmOf([...new Set(connections.map((connection) => connection.crm))]) || crm,
      connections: connections.map((connection) => connection.name),
      sites: tenants.filter((tenant) => tenant.active).flatMap((tenant) => tenant.sites),
      everyTenant: false,
      off: tenants.filter((tenant) => !tenant.active).map((tenant) => tenant.name),
      rules: list.rulesVersion,
      place,
    };
  }
  const tenants = tenantsOf(filter.tenants);
  const offices = list.offices.filter((office) => filter.offices.includes(office.key));
  const chosen = [
    filter.tenants.length === 0 ? 'all tenants' : listed(tenants.map((tenant) => tenant.name)),
    ...(offices.length > 0 ? [listed(offices.map((office) => office.name))] : []),
    filter.types.length === 0
      ? 'all record types'
      : filter.types.map((datatype) => capital(datatype)).join(', '),
    ...(filter.id ? [`${idWord(crms)} ${filter.id}`] : []),
  ].join(' · ');
  const named = filter.offices.length > 0 || filter.id !== '';
  return {
    chosen,
    count: list.total,
    choice: {
      filter: {
        tenants: filter.tenants,
        offices: filter.offices,
        types: filter.types,
        id: filter.id,
      },
    },
    fetch: named
      ? { kind: 'records', names: [], types: [] }
      : {
          kind: 'list',
          tenants: filter.tenants.length === 0 ? [] : tenants.map((tenant) => tenant.name),
          types: filter.types,
          everyConnection: filter.tenants.length === 0,
        },
    crm,
    connections: tenants.flatMap((tenant) => tenant.connections.map((one) => one.name)),
    sites: tenants.filter((tenant) => tenant.active).flatMap((tenant) => tenant.sites),
    everyTenant: filter.tenants.length === 0,
    off: tenants.filter((tenant) => !tenant.active).map((tenant) => tenant.name),
    rules: list.rulesVersion,
    place,
  };
}

function Filters({
  list,
  filter,
  onChange,
}: {
  list: RecordList;
  filter: RecordFilter;
  onChange: (next: RecordFilter) => void;
}) {
  const word = idWord(list.crms);
  const [typed, setTyped] = useState(filter.id);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => setTyped(filter.id), [filter.id]);
  const apply = (id: string) => {
    clearTimeout(timer.current);
    if (id.trim() !== filter.id) onChange({ ...filter, id: id.trim() });
  };
  const filtered =
    filter.tenants.length > 0 ||
    filter.offices.length > 0 ||
    filter.types.length > 0 ||
    filter.id !== '' ||
    filter.removed;
  const officeless = list.officeless.filter((datatype) =>
    list.types.some((one) => one.datatype === datatype),
  );
  const names = new Map(list.tenants.map((tenant) => [tenant.id, tenant.name]));
  return (
    <section className="k-box" aria-label="Filters">
      <div className="k-box-body">
        <div className="k-pair">
          <Picker
            id="records-tenants"
            label="Tenants"
            all="All tenants"
            boxes
            options={list.tenants.map((tenant) => ({
              key: String(tenant.id),
              name: tenant.name,
              count: tenant.count,
            }))}
            chosen={filter.tenants.map(String)}
            onChange={(next) => {
              const tenants = next.map(Number);
              // An office of a tenant no longer chosen leaves the filter with it.
              const offices = filter.offices.filter((key) => {
                const office = list.offices.find((one) => one.key === key);
                return !office || tenants.length === 0 || tenants.includes(office.tenant);
              });
              onChange({ ...filter, tenants, offices });
            }}
          />
          <Picker
            id="records-offices"
            label="Offices"
            all="All offices"
            boxes
            options={list.offices.map((office) => ({
              key: office.key,
              name: office.name,
              count: office.count,
              ...(filter.tenants.length === 0 && list.tenants.length > 1
                ? { detail: names.get(office.tenant) ?? '' }
                : {}),
            }))}
            chosen={filter.offices}
            onChange={(offices) => onChange({ ...filter, offices })}
          />
        </div>
        <div className="k-pair k-pair-next">
          <Picker
            id="records-types"
            label="Record types"
            all="All record types"
            boxes
            options={list.types.map((type) => ({
              key: type.datatype,
              name: capital(type.datatype),
              count: type.count,
            }))}
            chosen={filter.types}
            onChange={(types) => onChange({ ...filter, types: types as Datatype[] })}
            note={
              filter.offices.length > 0 && officeless.length > 0
                ? `${capital(pluralOf(officeless))} belong to no office, so an office filter leaves them out.`
                : undefined
            }
          />
          <label className="k-field k-field-first">
            <span className="k-label">{capital(word)}</span>
            <input
              className="k-input k-input-code"
              value={typed}
              placeholder={`Any ${word}`}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                const value = event.target.value;
                setTyped(value);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => apply(value), 500);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') apply(typed);
              }}
              onBlur={() => apply(typed)}
            />
          </label>
        </div>
        <div className="k-filter-foot">
          <Switch
            on={filter.removed}
            label="Include removed records"
            onChange={(removed) => onChange({ ...filter, removed })}
          />
          <p className="k-help k-filter-help">
            An empty filter means all.
            {filtered && (
              <button
                type="button"
                className="k-textlink k-filter-clear"
                onClick={() =>
                  onChange({ tenants: [], offices: [], types: [], id: '', removed: false })
                }
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function Empty({
  list,
  filter,
  onClearId,
}: {
  list: RecordList;
  filter: RecordFilter;
  onClearId: () => void;
}) {
  const crm = crmOf(list.crms);
  const word = idWord(list.crms);
  if (filter.id) {
    return (
      <div className="k-records-empty">
        <SearchIcon size={36} strokeWidth={1.5} />
        <h3>No record with this {word}</h3>
        <p>
          Core holds no record with the {word} {filter.id}, live or removed. Syncing by {word} only
          asks {crm} again about records Core already holds. To get a record that {crm} has and Core
          doesn’t: clear the {word}, choose the record’s tenant and record type, and sync with
          “Fetch from {crm}”.
        </p>
        <button
          type="button"
          className="k-button k-button-quiet k-button-small"
          onClick={onClearId}
        >
          <XIcon size={14} />
          Clear {word}
        </button>
      </div>
    );
  }
  return (
    <div className="k-records-empty">
      <SearchIcon size={36} strokeWidth={1.5} />
      <h3>No records</h3>
      <p>Core holds no record these filters keep.</p>
    </div>
  );
}

function Pages({ list, onPage }: { list: RecordList; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const first = (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.total, list.page * list.pageSize);
  return (
    <div className="k-records-foot">
      <span>
        {first}–{last} of {list.total} · by name
      </span>
      {pages > 1 && (
        <nav className="k-pages" aria-label="Pages">
          <button
            type="button"
            className="k-page-step"
            aria-label="Previous page"
            disabled={list.page === 1}
            onClick={() => onPage(list.page - 1)}
          >
            <ChevronLeftIcon size={16} />
          </button>
          {pageNumbers(list.page, pages).map((n, index) =>
            n === null ? (
              <span key={`gap-${String(index)}`} className="k-page-gap">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className={`k-page-number${n === list.page ? ' k-page-number-on' : ''}`}
                aria-current={n === list.page ? 'page' : undefined}
                onClick={() => onPage(n)}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            className="k-page-step"
            aria-label="Next page"
            disabled={list.page === pages}
            onClick={() => onPage(list.page + 1)}
          >
            <ChevronRightIcon size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

function RecordsView() {
  const { away } = useShell();
  const note = useNote();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useSearchParams();
  const filter = useMemo(() => filterOf(query), [query]);
  const page = Math.max(1, Number(query.get('page') ?? '1') || 1);
  const [list, setList] = useState<RecordList | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** A list is on its way: the first one, or the next after a filter, a page or a sync. */
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Map<string, RecordRow>>(new Map());
  const [syncing, setSyncing] = useState<SyncTarget | null>(null);
  const filterKey = recordQuery(filter).toString();

  /** The newest list asked for, so an answer for an older filter or page is not shown. */
  const asked = useRef(0);
  const load = useCallback(() => {
    const ask = ++asked.current;
    setLoading(true);
    api.records(filter, page).then(
      (next) => {
        if (ask !== asked.current) return;
        setList(next);
        setFailed(null);
        setLoading(false);
      },
      (error: unknown) => {
        if (ask !== asked.current) return;
        setLoading(false);
        if (!away(error)) setFailed(failureWords(error));
      },
    );
  }, [filter, page, away]);

  useEffect(() => load(), [load]);
  // A new filter starts the picking again.
  useEffect(() => setPicked(new Map()), [filterKey]);

  const sync = useSync('records', load);

  const change = (next: RecordFilter) => {
    sync.forgetFinished();
    setQuery(recordQuery(next));
  };
  const toPage = (n: number) => {
    const next = recordQuery(filter);
    if (n > 1) next.set('page', String(n));
    setQuery(next);
  };
  const toggle = (row: RecordRow) => {
    setPicked((was) => {
      const next = new Map(was);
      if (next.has(rowKey(row))) next.delete(rowKey(row));
      else if (next.size >= MOST_PICKED) {
        note({ text: `Up to ${String(MOST_PICKED)} records at a time.`, icon: 'warn' });
        return was;
      } else next.set(rowKey(row), row);
      return next;
    });
  };
  const open = (row: RecordRow) => navigate(recordPath(row), { state: { back: location.search } });

  const crms = list?.crms ?? [];
  const crm = crmOf(crms);
  const rows = list?.rows ?? [];
  const allPicked = rows.length > 0 && rows.every((row) => picked.has(rowKey(row)));

  return (
    <main className="k-page">
      <h1 className="k-page-title">Records</h1>
      <p className="k-page-sub">
        Properties, projects, agents, offices, areas and associations, as {crm}{' '}
        {crms.length === 1 ? 'lists' : 'list'} them. Core updates them by itself as {crm}{' '}
        {crms.length === 1 ? 'changes' : 'change'} them; sync here when a website can’t wait for
        that.
      </p>
      <SyncBanner kept={sync.kept} view={sync.view} removedHint={!filter.removed} />
      {!list && failed && (
        <p className="k-quiet" role="status">
          {failed} The page tries again when you reload it.
        </p>
      )}
      {!list && !failed && <Loading words="Loading records" />}
      {list && (
        <>
          <Filters list={list} filter={filter} onChange={change} />
          <section
            className={`k-box k-records${loading ? ' k-stale' : ''}`}
            aria-label="Records"
            aria-busy={loading}
          >
            <header className="k-box-head">
              {picked.size > 0 ? (
                <>
                  <p className="k-records-count">
                    <strong>{picked.size} picked</strong>
                    <span className="k-muted">up to {MOST_PICKED} at a time</span>
                    <button
                      type="button"
                      className="k-textlink"
                      onClick={() => setPicked(new Map())}
                    >
                      Clear
                    </button>
                  </p>
                  <button
                    type="button"
                    className="k-button k-button-primary k-button-small"
                    onClick={() => setSyncing(targetOf(list, filter, [...picked.values()]))}
                  >
                    <RefreshIcon size={16} />
                    Sync {picked.size} picked…
                  </button>
                </>
              ) : (
                <>
                  <p className="k-records-count">
                    <strong>{counted(list.total, 'record', 'records')}</strong>
                    {list.removed > 0 && <span className="k-muted">{list.removed} removed</span>}
                    {loading && <LoaderIcon className="k-spin" size={16} aria-label="Loading" />}
                  </p>
                  <button
                    type="button"
                    className="k-button k-button-quiet k-button-small"
                    disabled={list.total === 0}
                    onClick={() => setSyncing(targetOf(list, filter, []))}
                  >
                    <RefreshIcon size={16} />
                    Sync {counted(list.total, 'record', 'records')}…
                  </button>
                </>
              )}
            </header>
            {rows.length === 0 ? (
              <Empty list={list} filter={filter} onClearId={() => change({ ...filter, id: '' })} />
            ) : (
              <>
                <table className="k-table k-records-table">
                  <thead>
                    <tr>
                      <th className="k-pick-cell">
                        <input
                          type="checkbox"
                          className="k-tick"
                          aria-label="Pick every record on this page"
                          checked={allPicked}
                          onChange={() =>
                            setPicked((was) => {
                              const next = new Map(was);
                              if (allPicked) rows.forEach((row) => next.delete(rowKey(row)));
                              else
                                rows.forEach((row) => {
                                  if (next.size < MOST_PICKED) next.set(rowKey(row), row);
                                });
                              return next;
                            })
                          }
                        />
                      </th>
                      <th>Record</th>
                      <th className="k-wide-only">Type</th>
                      <th className="k-wide-only">
                        {crms.length === 1 ? `${crms[0] ?? ''} ID` : 'CRM ID'}
                      </th>
                      <th>Updated</th>
                      <th aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const on = picked.has(rowKey(row));
                      return (
                        <tr
                          key={rowKey(row)}
                          className={`k-row-link${on ? ' k-row-picked' : ''}`}
                          onClick={() => open(row)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') open(row);
                          }}
                          tabIndex={0}
                        >
                          <td className="k-pick-cell" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="k-tick"
                              aria-label={`Pick ${row.name}`}
                              checked={on}
                              onChange={() => toggle(row)}
                            />
                          </td>
                          <td>
                            <div
                              className={`k-record-name${row.removed ? ' k-record-removed' : ''}`}
                            >
                              <span>{row.name}</span>
                              {row.removed && <Badge tone="grey">Removed</Badge>}
                            </div>
                            <div className="k-record-sub">
                              <span className="k-phone-only">{capital(row.datatype)} · </span>
                              {[row.tenant.name, row.offices.join(', ')]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </td>
                          <td className="k-wide-only">{capital(row.datatype)}</td>
                          <td className="k-wide-only k-code">{row.id}</td>
                          <td className="k-nowrap">
                            {listTime(row.updatedAt, new Date(list.now))}
                          </td>
                          <td className="k-chevron-cell">
                            <ChevronRightIcon size={16} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <Pages list={list} onPage={toPage} />
              </>
            )}
          </section>
        </>
      )}
      {syncing && (
        <SyncWindow
          target={syncing}
          onClose={() => setSyncing(null)}
          onStarted={(kept) => {
            setSyncing(null);
            setPicked(new Map());
            sync.start(kept);
            if (kept.started.what === 'send') load();
          }}
        />
      )}
    </main>
  );
}

/** `/admin/records`. */
export function RecordsPage() {
  return (
    <Shell tab="records">
      <RecordsView />
    </Shell>
  );
}
