// A new tenant in four steps (design B, images 06 to 10, as the tenant mockups 17 to 20 change
// them): its name, its CRM (which one, then that CRM's own screen), its website, and a check that
// shows what is ready and what the website still needs. Each step has its own address, so a reload
// keeps the step.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { api, Refused, type Brokerage, type Crm } from './api';
import { Shell, useShell, type Arrival } from './Shell';
import { failureWords } from './failure';
import { ArrowRightIcon, CheckIcon, CircleCheckIcon, LoaderIcon } from './icons';
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
import { CrmChoice, CrmFields, owning, saveCrm, shortName, TestNote, useCrmForm } from './connect';
import { idOf } from './tenant';

const EVERY_MS = 4_000;

const STEPS = ['Tenant', 'CRM', 'Website', 'Check'];

function StepBar({ at }: { at: 1 | 2 | 3 | 4 }) {
  const steps = STEPS;
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
  parts = false,
  children,
  footer,
}: {
  at: 1 | 2 | 3 | 4;
  /** The body is in parts, each under a line, as the CRM's screen is. */
  parts?: boolean;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="k-page">
      <h1 className="k-page-title k-page-title-large">New tenant</h1>
      <StepBar at={at} />
      <div className="k-wizard">
        <div className={`k-wizard-body${parts ? ' k-wizard-parts' : ''}`}>{children}</div>
        <div className="k-wizard-foot">{footer}</div>
      </div>
    </main>
  );
}

/** The tenant a step belongs to, read again every few seconds when the step asks for it. */
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

// ---- 1. The tenant's name ---------------------------------------------------------------------------

function NameStep({ id }: { id: number | null }) {
  const navigate = useNavigate();
  const { away } = useShell();
  const { page, failed } = useBrokerage(id);
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
          <label className="k-label" htmlFor="tenant-name">
            Tenant name <span className="k-required">*</span>
          </label>
          <input
            id="tenant-name"
            className="k-input"
            autoFocus={!made}
            disabled={made}
            value={made ? (page?.name ?? '') : name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="k-help">Core creates the tenant and its tenant token.</p>
        </div>
      </form>
      {made && failed && !page && <p className="k-error">{failed} Reload the page to try again.</p>}
      {error && <p className="k-error">{error}</p>}
    </Wizard>
  );
}

// ---- 2. The CRM: which one, then its own screen ---------------------------------------------------

function CrmStep({ id }: { id: number }) {
  const [params] = useSearchParams();
  const { page, failed } = useBrokerage(id);
  const provider = params.get('provider');
  const crm = page?.crms.find((one) => one.provider === provider) ?? null;
  if (page && crm) return <CrmForm key={crm.provider} id={id} page={page} crm={crm} />;
  return <CrmChoiceStep id={id} page={page} failed={failed} />;
}

/** "Connect Fyrbåk’s CRM" (image 18): which CRM, the same question however many Core can read. */
function CrmChoiceStep({
  id,
  page,
  failed,
}: {
  id: number;
  page: Brokerage | null;
  failed: string | null;
}) {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<string | null>(null);
  const picked = chosen ?? page?.crms[0]?.provider ?? null;
  return (
    <Wizard
      at={2}
      footer={
        <>
          <button
            type="button"
            className="k-button k-button-link"
            onClick={() => navigate(`/new/${String(id)}`)}
          >
            Back
          </button>
          <button
            type="button"
            className="k-button k-button-primary k-end"
            disabled={picked === null}
            onClick={() =>
              picked && navigate(`/new/${String(id)}/crm?provider=${encodeURIComponent(picked)}`)
            }
          >
            <ArrowRightIcon size={18} />
            Continue
          </button>
        </>
      }
    >
      {page && <h2 className="k-step-title">Connect {owning(shortName(page.name))} CRM</h2>}
      {failed && !page && <p className="k-error">{failed} Reload the page to try again.</p>}
      {page && page.crms.length === 0 && (
        <p className="k-quiet k-quiet-tight">Core has no CRM to connect to.</p>
      )}
      {page && page.crms.length > 0 && (
        <CrmChoice crms={page.crms} chosen={picked} onChoose={setChosen} />
      )}
    </Wizard>
  );
}

/** "Connect Fyrbåk’s <CRM>" (image 19): the CRM's own screen, as Add CRM shows it. */
function CrmForm({ id, page, crm }: { id: number; page: Brokerage; crm: Crm }) {
  const navigate = useNavigate();
  const { away } = useShell();
  const form = useCrmForm(crm);
  const save = async () => {
    const saved = await saveCrm(form, crm, { tenantId: id }, away);
    if (saved) {
      navigate(`/new/${String(id)}/website?connection=${encodeURIComponent(saved.id)}`);
    }
  };
  return (
    <Wizard
      at={2}
      parts
      footer={
        <>
          <button
            type="button"
            className="k-button k-button-link"
            onClick={() => navigate(`/new/${String(id)}/crm`)}
          >
            Back
          </button>
          <TestNote crm={crm} />
          <button
            type="button"
            className="k-button k-button-primary"
            disabled={form.busy || !form.ready}
            onClick={() => void save()}
          >
            {form.busy ? <LoaderIcon className="k-spin" size={18} /> : <ArrowRightIcon size={18} />}
            Test login and continue
          </button>
        </>
      }
    >
      <CrmFields
        crm={crm}
        form={form}
        editing={false}
        title={`Connect ${owning(shortName(page.name))} ${crm.name}`}
      />
    </Wizard>
  );
}

// ---- 3. The website ---------------------------------------------------------------------------------

function WebsiteStep({ id }: { id: number }) {
  const navigate = useNavigate();
  const { away } = useShell();
  const [params] = useSearchParams();
  const { page, failed } = useBrokerage(id);
  const [draft, setDraft] = useState(newWebsite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = params.get('connection');
  const check = (site?: number, warning?: string) => {
    const next = new URLSearchParams();
    if (connection) next.set('connection', connection);
    if (site !== undefined) {
      next.set('site', String(site));
      next.set('platform', draft.platform);
    }
    const arrival: Arrival | undefined = warning ? { warning } : undefined;
    navigate(`/new/${String(id)}/check?${next.toString()}`, { state: arrival });
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id: site, warning } = await api.addWebsite(id, {
        label: draft.label.trim(),
        bellUrl: draft.bellUrl.trim(),
      });
      check(site, warning);
    } catch (failure) {
      if (away(failure)) return;
      setError(
        failure instanceof Refused && failure.status === 400 && !failure.said
          ? 'Check the bell address: it starts with https://.'
          : failureWords(failure),
      );
      setBusy(false);
    }
  };
  return (
    <Wizard
      at={3}
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
      {page && <h2 className="k-step-title">Add {owning(shortName(page.name))} website</h2>}
      {failed && !page && <p className="k-error">{failed} Reload the page to try again.</p>}
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
      {failed && !page && <p className="k-error">{failed} Reload the page to try again.</p>}
      {page && (
        <ul className="k-checks">
          <Done title="Tenant created">Tenant token ready.</Done>
          {connection && crm && (
            <Done title={`${crm.name} login accepted and saved`}>{connection.describe}</Done>
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

/** `/admin/new` and `/admin/new/<id>`: the tenant's name. */
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
          <p className="k-quiet">There is no tenant at this address.</p>
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
