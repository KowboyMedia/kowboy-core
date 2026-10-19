// A website's screen (the tenant mockups, images 05 and 06): one screen adds a website and edits
// one. Adding saves its fields and goes on to the same screen in edit mode, which shows the
// settings to copy into the website, as Settings and "…" did on B's tenant page, with "New bell
// secret…".
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { api, Refused, type Brokerage, type Website } from './api';
import { Shell, useShell, type Arrival } from './Shell';
import { failureWords } from './failure';
import { ArrowRightIcon, CheckIcon, CircleCheckIcon, KeyIcon, LoaderIcon } from './icons';
import { when } from './time';
import { Modal, useNote } from './ui';
import {
  clientLine,
  isPlatform,
  newWebsite,
  platformOf,
  savedWebsite,
  SettingsToPaste,
  WebsiteFields,
  websiteReady,
  type WebsiteDraft,
} from './websites';
import { idOf, Nothing, UnderTenant, useTenant } from './tenant';

/** Why Core did not save a website's fields. */
const websiteRefusal = (error: unknown): string =>
  error instanceof Refused && error.status === 400
    ? 'Check the bell address: it starts with https://.'
    : failureWords(error);

/** The fields, and the foot with Cancel and the button that saves them. */
function FieldsForm({
  draft,
  onChange,
  adding,
  busy,
  failed,
  onCancel,
  onSave,
}: {
  draft: WebsiteDraft;
  onChange: (draft: WebsiteDraft) => void;
  adding: boolean;
  busy: boolean;
  failed: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  const ready = websiteReady(draft);
  return (
    <div className="k-wizard">
      <div className="k-wizard-body">
        <WebsiteFields draft={draft} onChange={onChange} adding={adding} />
        {failed && <p className="k-error">{failed}</p>}
      </div>
      <div className="k-wizard-foot">
        <button type="button" className="k-button k-button-link" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="k-button k-button-primary k-end"
          disabled={busy || !ready}
          onClick={onSave}
        >
          {busy ? (
            <LoaderIcon className="k-spin" size={18} />
          ) : adding ? (
            <ArrowRightIcon size={18} />
          ) : (
            <CheckIcon size={18} />
          )}
          {adding ? 'Save and continue' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ---- Add ------------------------------------------------------------------------------------------

function AddForm({ page }: { page: Brokerage }) {
  const navigate = useNavigate();
  const { away } = useShell();
  const [draft, setDraft] = useState(newWebsite);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const base = `/brokerages/${String(page.id)}`;
  const save = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const label = draft.label.trim();
      const { id } = await api.addWebsite(page.id, { label, bellUrl: draft.bellUrl.trim() });
      const arrival: Arrival = { note: `${label} added.` };
      navigate(`${base}/websites/${String(id)}?platform=${draft.platform}`, {
        replace: true,
        state: arrival,
      });
    } catch (error) {
      if (away(error)) return;
      setFailed(websiteRefusal(error));
      setBusy(false);
    }
  };
  return (
    <FieldsForm
      draft={draft}
      onChange={setDraft}
      adding
      busy={busy}
      failed={failed}
      onCancel={() => navigate(base)}
      onSave={() => void save()}
    />
  );
}

function AddPage({ id }: { id: number }) {
  const read = useTenant(id);
  return (
    <UnderTenant read={read} title={() => 'Add website'}>
      {(page) => <AddForm page={page} />}
    </UnderTenant>
  );
}

// ---- Edit -----------------------------------------------------------------------------------------

/** "New bell secret for lindqvistholm.se?": the old one stops working at once. */
function NewBellSecretWindow({
  website,
  onClose,
  onDone,
}: {
  website: Website;
  onClose: () => void;
  onDone: () => void;
}) {
  const { away } = useShell();
  const note = useNote();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const make = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await api.newBellSecret(website.id);
      note({ text: `New bell secret made. Copy it into ${website.label}.` });
      onDone();
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`New bell secret for ${website.label}?`}
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
            onClick={() => void make()}
          >
            <KeyIcon size={18} />
            Make new bell secret
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        The current bell secret stops working at once: {website.label} refuses Core’s change notices
        until the new one is pasted into it.
      </p>
      {failed && <p className="k-error">{failed}</p>}
    </Modal>
  );
}

/** "Settings in the website" (image 06): whether it fetched, and what to copy into it. */
function SettingsBox({
  page,
  website,
  onChanged,
}: {
  page: Brokerage;
  website: Website;
  onChanged: () => void;
}) {
  const [params] = useSearchParams();
  const [asking, setAsking] = useState(false);
  const chosen = params.get('platform');
  const platform = platformOf(website) ?? (isPlatform(chosen) ? chosen : null);
  const now = new Date(page.now);
  return (
    <section className="k-box">
      <header className="k-box-head">
        <h2>Settings in the website</h2>
      </header>
      <div className="k-box-body">
        {website.lastFetchAt ? (
          <div className="k-banner k-banner-done">
            <CircleCheckIcon size={18} />
            <div>
              <p className="k-banner-title">{website.label} is connected</p>
              <p className="k-banner-text">
                It fetched its data at {when(website.lastFetchAt, now)}
                {website.client ? ` (${clientLine(website)})` : ''}.
              </p>
            </div>
          </div>
        ) : (
          <div className="k-banner k-banner-info">
            <LoaderIcon className="k-spin" size={18} />
            <div>
              <p className="k-banner-title">Waiting for {website.label} to contact Core</p>
            </div>
          </div>
        )}
        <SettingsToPaste
          coreUrl={page.coreUrl}
          token={page.token}
          bellSecret={website.bellSecret}
          platform={platform}
          live={!website.lastFetchAt}
          bellAction={{
            button: (
              <button
                type="button"
                className="k-button k-button-quiet k-button-small"
                onClick={() => setAsking(true)}
              >
                <KeyIcon size={14} />
                New bell secret…
              </button>
            ),
            help: 'A new bell secret only if this one leaked: the website refuses Core’s change notices until the new one is pasted into it.',
          }}
        />
      </div>
      {asking && (
        <NewBellSecretWindow
          website={website}
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

function EditForm({ page, website }: { page: Brokerage; website: Website }) {
  const navigate = useNavigate();
  const { away } = useShell();
  const [draft, setDraft] = useState(() => savedWebsite(website));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const base = `/brokerages/${String(page.id)}`;
  const save = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const label = draft.label.trim();
      await api.editWebsite(website.id, { label, bellUrl: draft.bellUrl.trim() });
      const arrival: Arrival = { note: `“${label}” is saved.` };
      navigate(base, { state: arrival });
    } catch (error) {
      if (away(error)) return;
      setFailed(websiteRefusal(error));
      setBusy(false);
    }
  };
  return (
    <FieldsForm
      draft={draft}
      onChange={setDraft}
      adding={false}
      busy={busy}
      failed={failed}
      onCancel={() => navigate(base)}
      onSave={() => void save()}
    />
  );
}

function EditPage({ id, site }: { id: number; site: number }) {
  const [waiting, setWaiting] = useState(true);
  const read = useTenant(id, waiting);
  const website = read.page?.websites.find((one) => one.id === site);
  const fetched = website?.lastFetchAt !== null && website?.lastFetchAt !== undefined;
  // While the website has not fetched, the page reads again often, to say when it has.
  useEffect(() => setWaiting(!fetched), [fetched]);
  if (read.page && !website) {
    return <Nothing words="There is no website at this address: it was deleted or never added." />;
  }
  return (
    <UnderTenant read={read} title={() => `Edit ${website?.label ?? ''}`}>
      {(page) =>
        website && (
          <>
            <EditForm key={website.id} page={page} website={website} />
            <SettingsBox page={page} website={website} onChanged={() => void read.load()} />
          </>
        )
      }
    </UnderTenant>
  );
}

/** `/admin/brokerages/<id>/websites/new`. */
export function AddWebsitePage() {
  const number = idOf(useParams().id);
  return (
    <Shell tab="brokerages">
      {number === null ? <Nothing /> : <AddPage key={number} id={number} />}
    </Shell>
  );
}

/** `/admin/brokerages/<id>/websites/<website>`. */
export function EditWebsitePage() {
  const params = useParams();
  const number = idOf(params.id);
  const site = idOf(params.site);
  return (
    <Shell tab="brokerages">
      {number === null || site === null ? (
        <Nothing />
      ) : (
        <EditPage key={`${String(number)} ${String(site)}`} id={number} site={site} />
      )}
    </Shell>
  );
}
