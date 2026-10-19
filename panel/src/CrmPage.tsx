// A CRM connection's screen (the tenant mockups, images 08 to 10): one screen adds a connection
// and edits one, from the tenant's page and from the Inbox's "Enter new login". It holds the
// fields the CRM's code declares and Core's own forms test mode. Core tests a login with the CRM
// only when it changed; a saved secret left empty stays.
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { Brokerage, ConnectionView, Crm } from './api';
import { Shell, useShell, type Arrival } from './Shell';
import { CheckIcon, LoaderIcon, PlugIcon } from './icons';
import { CrmFields, saveCrm, TestNote, useCrmForm } from './connect';
import { crmFor, idOf, Nothing, UnderTenant, useTenant } from './tenant';

/** Where the screen goes back to: the tenant's page, or the Inbox it was opened from. */
function useBack(page: Brokerage): { to: string; words: string } {
  const [params] = useSearchParams();
  return params.get('from') === 'inbox'
    ? { to: '/', words: 'Inbox' }
    : { to: `/brokerages/${String(page.id)}`, words: page.name };
}

function CrmForm({
  page,
  crm,
  connection,
}: {
  page: Brokerage;
  crm: Crm;
  /** A saved connection to edit; none to add one. */
  connection?: ConnectionView;
}) {
  const navigate = useNavigate();
  const { away } = useShell();
  const form = useCrmForm(crm, connection);
  const back = useBack(page);
  const editing = connection !== undefined;
  const save = async () => {
    const saved = await saveCrm(
      form,
      crm,
      connection ? { connection } : { tenantId: page.id },
      away,
    );
    if (!saved) return;
    const arrival: Arrival = {
      note: !editing
        ? `${crm.name} accepted the login. “${saved.name}” is saved, and Core is loading its data.`
        : saved.tested
          ? `${crm.name} accepted the login. “${saved.name}” is saved.`
          : `“${saved.name}” is saved.`,
    };
    navigate(back.to, { state: arrival });
  };
  return (
    <div className="k-wizard">
      <div className="k-wizard-body k-wizard-parts">
        <CrmFields crm={crm} form={form} editing={editing} />
      </div>
      <div className="k-wizard-foot">
        <button type="button" className="k-button k-button-link" onClick={() => navigate(back.to)}>
          Cancel
        </button>
        {form.tests && <TestNote crm={crm} />}
        <button
          type="button"
          className={`k-button k-button-primary${form.tests ? '' : ' k-end'}`}
          disabled={form.busy || !form.ready}
          onClick={() => void save()}
        >
          {form.busy ? (
            <LoaderIcon className="k-spin" size={18} />
          ) : form.tests ? (
            <PlugIcon size={18} />
          ) : (
            <CheckIcon size={18} />
          )}
          {form.tests ? 'Test and save' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function AddPage({ id }: { id: number }) {
  const read = useTenant(id);
  const [params] = useSearchParams();
  const provider = params.get('provider');
  const crm = read.page?.crms.find((one) => one.provider === provider) ?? null;
  if (read.page && !crm) return <Nothing words="Core can’t read this CRM." />;
  return (
    <UnderTenant read={read} title={() => `Add ${crm?.name ?? ''}`}>
      {(page) => crm && <CrmForm key={crm.provider} page={page} crm={crm} />}
    </UnderTenant>
  );
}

function EditPage({ id, connectionId }: { id: number; connectionId: string }) {
  const read = useTenant(id);
  const [params] = useSearchParams();
  const connection = read.page?.connections.find((one) => one.id === connectionId);
  if (read.page && !connection) {
    return (
      <Nothing words="There is no CRM connection at this address: it was deleted or never added." />
    );
  }
  return (
    <UnderTenant
      read={read}
      title={() => `Edit ${connection?.name ?? ''}`}
      back={params.get('from') === 'inbox' ? { to: '/', words: 'Inbox' } : undefined}
    >
      {(page) =>
        connection && (
          <CrmForm
            key={connection.id}
            page={page}
            crm={crmFor(page, connection.provider)}
            connection={connection}
          />
        )
      }
    </UnderTenant>
  );
}

/** `/admin/brokerages/<id>/crms/new?provider=<provider>`. */
export function AddCrmPage() {
  const number = idOf(useParams().id);
  return (
    <Shell tab="brokerages">
      {number === null ? <Nothing /> : <AddPage key={number} id={number} />}
    </Shell>
  );
}

/** `/admin/brokerages/<id>/connections/<connection>`, with `?from=inbox` from the Inbox. */
export function EditCrmPage() {
  const { id, connection } = useParams();
  const [params] = useSearchParams();
  const number = idOf(id);
  return (
    <Shell tab={params.get('from') === 'inbox' ? 'inbox' : 'brokerages'}>
      {number === null || !connection ? (
        <Nothing />
      ) : (
        <EditPage key={`${String(number)} ${connection}`} id={number} connectionId={connection} />
      )}
    </Shell>
  );
}
