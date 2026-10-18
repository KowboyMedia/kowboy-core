// A new brokerage in four steps (design B, images 06 to 10): its name, its CRM login, its
// website, and a check that shows what is ready and what the website still needs. Each step has
// its own address, so a reload keeps the step.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { api, Refused, type Brokerage, type Crm } from './api';
import { Shell, useShell } from './Shell';
import { failureWords } from './failure';
import { ArrowRightIcon, CheckIcon, CircleCheckIcon, LoaderIcon } from './icons';
import { loginLine } from './crm-words';
import { when } from './time';
import { loadedLine } from './records';
import {
  clientLine,
  isPlatform,
  newWebsite,
  SettingsToPaste,
  WebsiteFields,
  websiteReady,
} from './websites';
import {
  ConnectFields,
  connect,
  connectReady,
  loginRefusal,
  owning,
  shortName,
  useConnectForm,
} from './connect';

const EVERY_MS = 4_000;

function StepBar({ at, crm }: { at: 1 | 2 | 3 | 4; crm: string }) {
  const steps = ['Brokerage', crm, 'Website', 'Check'];
  return (
    <ol className="k-steps">
      {steps.map((label, index) => {
        const n = index + 1;
        return (
          <li
            key={label}
            className={`k-step${n <= at ? ' k-step-done' : ''}${n === at ? ' k-step-at' : ''}`}
            aria-current={n === at ? 'step' : undefined}
          >
            <span className="k-step-dot">{n}</span>
            <span className="k-step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Wizard({
  at,
  crm,
  children,
  footer,
}: {
  at: 1 | 2 | 3 | 4;
  crm: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="k-page">
      <h1 className="k-page-title k-page-title-large">New brokerage</h1>
      <StepBar at={at} crm={crm} />
      <div className="k-wizard">
        <div className="k-wizard-body">{children}</div>
        <div className="k-wizard-foot">{footer}</div>
      </div>
    </main>
  );
}

/** The brokerage a step belongs to, read again every few seconds when the step asks for it. */
function useBrokerage(id: number | null, every: number | null = null) {
  const { away } = useShell();
  const [page, setPage] = useState<Brokerage | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (id === null) return;
    try {
      setPage(await api.brokerage(id));
      setFailed(null);
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
    }
  }, [id, away]);
  useEffect(() => {
    void load();
    if (every === null) return;
    const timer = setInterval(() => void load(), every);
    return () => clearInterval(timer);
  }, [load, every]);
  return { page, failed };
}

/** The CRM a new brokerage connects to: the one the address names, else the first Core has. */
function useCrmName(): string {
  const [name, setName] = useState('CRM');
  const [params] = useSearchParams();
  const provider = params.get('provider');
  useEffect(() => {
    api.crms().then(
      ({ crms }) => {
        const crm = crms.find((one) => one.provider === provider) ?? crms[0];
        if (crm) setName(crm.name);
      },
      () => undefined,
    );
  }, [provider]);
  return name;
}

const idOf = (value: string | undefined): number | null =>
  value && /^\d+$/.test(value) ? Number(value) : null;

// ---- 1. The brokerage's name ------------------------------------------------------------------------

function NameStep({ id }: { id: number | null }) {
  const navigate = useNavigate();
  const { away } = useShell();
  const crm = useCrmName();
  const { page } = useBrokerage(id);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const made = id !== null;

  const next = async () => {
    if (made) {
      navigate(`/new/${String(id)}/crm`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.createBrokerage(name.trim());
      navigate(`/new/${String(created.id)}/crm`);
    } catch (failure) {
      if (!away(failure)) setError(failureWords(failure));
      setBusy(false);
    }
  };

  return (
    <Wizard
      at={1}
      crm={crm}
      footer={
        <>
          <button
            type="button"
            className="k-button k-button-link"
            onClick={() => navigate(made ? `/brokerages/${String(id)}` : '/brokerages')}
          >
            Cancel
          </button>
          <button
            type="button"
            className="k-button k-button-primary k-end"
            disabled={busy || (!made && name.trim() === '')}
            onClick={() => void next()}
          >
            <ArrowRightIcon size={18} />
            Continue
          </button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (made || name.trim() !== '') void next();
        }}
      >
        <div className="k-field k-field-first">
          <label className="k-label" htmlFor="brokerage-name">
            Brokerage name <span className="k-required">*</span>
          </label>
          <input
            id="brokerage-name"
            className="k-input"
            autoFocus={!made}
            disabled={made}
            value={made ? (page?.name ?? '') : name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="k-help">Core creates the brokerage and its tenant token.</p>
        </div>
      </form>
      {error && <p className="k-error">{error}</p>}
    </Wizard>
  );
}

// ---- 2. The CRM's login -----------------------------------------------------------------------------

function CrmStep({ id }: { id: number }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { page, failed } = useBrokerage(id);
  const crm = page
    ? (page.crms.find((one) => one.provider === params.get('provider')) ?? page.crms[0] ?? null)
    : null;
  if (page && crm) return <CrmForm key={crm.provider} id={id} page={page} crm={crm} />;
  return (
    <Wizard
      at={2}
      crm="CRM"
      footer={
        <button
          type="button"
          className="k-button k-button-link"
          onClick={() => navigate(`/new/${String(id)}`)}
        >
          Back
        </button>
      }
    >
      {failed && <p className="k-error">{failed}</p>}
      {page && <p className="k-quiet k-quiet-tight">Core has no CRM to connect to.</p>}
    </Wizard>
  );
}

function CrmForm({ id, page, crm }: { id: number; page: Brokerage; crm: Crm }) {
  const navigate = useNavigate();
  const { away } = useShell();
  const short = shortName(page.name);
  const form = useConnectForm(crm);
  const save = async () => {
    form.setBusy(true);
    form.setError(null);
    try {
      const connection = await connect(id, crm, form.login);
      navigate(`/new/${String(id)}/website?connection=${encodeURIComponent(connection.id)}`);
    } catch (error) {
      if (away(error)) return;
      form.setError(loginRefusal(error, crm.name));
      form.setBusy(false);
    }
  };
  return (
    <Wizard
      at={2}
      crm={crm.name}
      footer={
        <>
          <button
            type="button"
            className="k-button k-button-link"
            onClick={() => navigate(`/new/${String(id)}`)}
          >
            Back
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
            {form.busy ? <LoaderIcon className="k-spin" size={18} /> : <ArrowRightIcon size={18} />}
            Test login and continue
          </button>
        </>
      }
    >
      <ConnectFields crm={crm} form={form} title={`Connect ${owning(short)} ${crm.name}`} />
      {form.error && <p className="k-error">{form.error}</p>}
    </Wizard>
  );
}

// ---- 3. The website ---------------------------------------------------------------------------------

function WebsiteStep({ id }: { id: number }) {
  const navigate = useNavigate();
  const { away } = useShell();
  const [params] = useSearchParams();
  const crm = useCrmName();
  const { page } = useBrokerage(id);
  const [draft, setDraft] = useState(newWebsite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = params.get('connection');
  const check = (site?: number) => {
    const next = new URLSearchParams();
    if (connection) next.set('connection', connection);
    if (site !== undefined) {
      next.set('site', String(site));
      next.set('platform', draft.platform);
    }
    navigate(`/new/${String(id)}/check?${next.toString()}`);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id: site } = await api.addWebsite(id, {
        label: draft.label.trim(),
        bellUrl: draft.bellUrl.trim(),
      });
      check(site);
    } catch (failure) {
      if (away(failure)) return;
      setError(
        failure instanceof Refused && failure.status === 400
          ? 'Check the bell address: it starts with https://.'
          : failureWords(failure),
      );
      setBusy(false);
    }
  };
  return (
    <Wizard
      at={3}
      crm={crm}
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={() => check()}>
            Skip for now
          </button>
          <button
            type="button"
            className="k-button k-button-primary k-end"
            disabled={busy || !websiteReady(draft)}
            onClick={() => void save()}
          >
            <ArrowRightIcon size={18} />
            Save and continue
          </button>
        </>
      }
    >
      <h2 className="k-step-title">Add {owning(shortName(page?.name ?? ''))} website</h2>
      <WebsiteFields draft={draft} onChange={setDraft} />
      {error && <p className="k-error">{error}</p>}
    </Wizard>
  );
}

// ---- 4. The check -----------------------------------------------------------------------------------

function Done({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <li className="k-check k-check-done">
      <CircleCheckIcon className="k-check-icon" size={20} />
      <div>
        <div className="k-check-title">{title}</div>
        {children && <div className="k-check-sub">{children}</div>}
      </div>
    </li>
  );
}

function CheckStep({ id }: { id: number }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { page, failed } = useBrokerage(id, EVERY_MS);
  const connection = page?.connections.find((one) => one.id === params.get('connection'));
  const crm = connection
    ? (page?.crms.find((one) => one.provider === connection.provider) ?? null)
    : (page?.crms[0] ?? null);
  const siteId = Number(params.get('site'));
  const site = page?.websites.find((one) => one.id === siteId);
  const platform = params.get('platform');
  const loaded = connection ? loadedLine(connection.counts) : '';
  const now = new Date(page?.now ?? Date.now());

  return (
    <Wizard
      at={4}
      crm={crm?.name ?? 'CRM'}
      footer={
        <button
          type="button"
          className="k-button k-button-primary k-end"
          onClick={() => navigate(`/brokerages/${String(id)}`)}
        >
          <CheckIcon size={18} />
          Finish
        </button>
      }
    >
      <h2 className="k-step-title">Almost there</h2>
      {failed && !page && <p className="k-error">{failed}</p>}
      {page && (
        <ul className="k-checks">
          <Done title="Brokerage created">Tenant token ready.</Done>
          {connection && crm && (
            <Done title={`${crm.name} login accepted and saved`}>
              {loginLine(crm.name, crm.provider, connection.login)}
            </Done>
          )}
          {connection && connection.offices.length > 0 && (
            <Done title={`Offices on the website: ${connection.offices.join(', ')}`} />
          )}
          {loaded && <Done title="Data loaded">{loaded}</Done>}
          {site?.lastFetchAt && (
            <Done title={`${site.label} is connected`}>
              It fetched its data at {when(site.lastFetchAt, now)}
              {site.client ? ` (${clientLine(site)})` : ''}.
            </Done>
          )}
          {site && !site.lastFetchAt && (
            <li className="k-check">
              <LoaderIcon className="k-check-icon k-check-wait" size={20} />
              <div className="k-check-grow">
                <div className="k-check-title">Waiting for {site.label} to contact Core</div>
                <SettingsToPaste
                  coreUrl={page.coreUrl}
                  token={page.token}
                  bellSecret={site.bellSecret}
                  platform={isPlatform(platform) ? platform : null}
                />
              </div>
            </li>
          )}
        </ul>
      )}
    </Wizard>
  );
}

// ---- The addresses ----------------------------------------------------------------------------------

/** `/admin/new` and `/admin/new/<id>`: the brokerage's name. */
export function NewBrokeragePage() {
  const { id } = useParams();
  return (
    <Shell tab={null}>
      <NameStep key={id ?? 'new'} id={idOf(id)} />
    </Shell>
  );
}

/** `/admin/new/<id>/<step>`: the steps after the name. */
export function NewBrokerageStep({ step }: { step: 'crm' | 'website' | 'check' }) {
  const { id } = useParams();
  const number = idOf(id);
  return (
    <Shell tab={null}>
      {number === null ? (
        <main className="k-page">
          <p className="k-quiet">There is no brokerage at this address.</p>
        </main>
      ) : step === 'crm' ? (
        <CrmStep id={number} />
      ) : step === 'website' ? (
        <WebsiteStep id={number} />
      ) : (
        <CheckStep id={number} />
      )}
    </Shell>
  );
}
