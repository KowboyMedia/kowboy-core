// "Edit tenant" (the tenant mockups, image 04): the tenant's name, as step 1 of New tenant asks it.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, type Brokerage } from './api';
import { Shell, useShell, type Arrival } from './Shell';
import { failureWords } from './failure';
import { CheckIcon } from './icons';
import { idOf, Nothing, UnderTenant, useTenant } from './tenant';

function NameForm({ page }: { page: Brokerage }) {
  const navigate = useNavigate();
  const { away } = useShell();
  const [name, setName] = useState(page.name);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const back = `/brokerages/${String(page.id)}`;
  const ready = name.trim() !== '';
  const save = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await api.editBrokerage(page.id, name.trim());
      const arrival: Arrival = { note: `“${name.trim()}” is saved.` };
      navigate(back, { state: arrival });
    } catch (error) {
      if (!away(error)) setFailed(failureWords(error));
      setBusy(false);
    }
  };
  return (
    <form
      className="k-wizard"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !busy) void save();
      }}
    >
      <div className="k-wizard-body">
        <div className="k-field k-field-first">
          <label className="k-label" htmlFor="tenant-name">
            Tenant name <span className="k-required">*</span>
          </label>
          <input
            id="tenant-name"
            className="k-input"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="k-help">Shown in Core’s lists.</p>
        </div>
        {failed && <p className="k-error">{failed}</p>}
      </div>
      <div className="k-wizard-foot">
        <button type="button" className="k-button k-button-link" onClick={() => navigate(back)}>
          Cancel
        </button>
        <button type="submit" className="k-button k-button-primary k-end" disabled={busy || !ready}>
          <CheckIcon size={18} />
          Save
        </button>
      </div>
    </form>
  );
}

function Page({ id }: { id: number }) {
  const read = useTenant(id);
  return (
    <UnderTenant read={read} title={() => 'Edit tenant'}>
      {(page) => <NameForm page={page} />}
    </UnderTenant>
  );
}

/** `/admin/brokerages/<id>/edit`. */
export function EditTenantPage() {
  const number = idOf(useParams().id);
  return (
    <Shell tab="brokerages">
      {number === null ? <Nothing /> : <Page key={number} id={number} />}
    </Shell>
  );
}
