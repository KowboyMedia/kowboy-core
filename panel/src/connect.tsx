// Connecting a brokerage to a CRM, and entering a new login (design B, images 07 and 15): the
// connection's name and the CRM's login, which Core tests with the CRM and saves only if the CRM
// accepts it.
import { useState, type ReactNode } from 'react';
import { api, Refused, type ConnectionView, type Crm } from './api';
import { complete, LoginFields, startingLogin, type Login } from './LoginForm';
import { fieldWords, wordsFor } from './crm-words';
import { listed } from './time';
import { failureWords } from './failure';
import { Modal, useNote } from './ui';
import { useShell } from './Shell';
import { LoaderIcon, PlugIcon } from './icons';

/** A brokerage's short name, as B says it: the first word of "Fyrbåk Fastigheter". */
export const shortName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** "Fyrbåk’s", "Sjöbris’". */
export const owning = (name: string): string => (name.endsWith('s') ? `${name}’` : `${name}’s`);

/** Why Core did not save a login, for the person who typed it. */
export function loginRefusal(error: unknown, crm: string): string {
  if (error instanceof Refused) {
    if (error.status === 422) {
      return `${crm} refused this login, so nothing is saved. Check the fields and try again.`;
    }
    if (error.status === 502) {
      return `${crm} didn’t answer, so nothing is saved. Try again in a moment.`;
    }
    if (error.status === 400) return 'Fill in every field.';
  }
  return failureWords(error);
}

/**
 * What a saved login keeps when a person enters a new one: every field that is not secret, as
 * saved (decision D5). A secret field is never sent to the page, so it is entered again.
 */
export function keptLogin(crm: Crm, connection: ConnectionView): Login {
  return Object.fromEntries(
    crm.fields
      .filter((field) => !field.secret && connection.login[field.key] !== undefined)
      .map((field) => [field.key, connection.login[field.key] ?? '']),
  );
}

/** The secret fields of a login in a sentence: "password". */
export const secretWords = (crm: Crm): { words: string; many: boolean } => {
  const secret = crm.fields.filter((field) => field.secret);
  return {
    words: listed(
      secret.map((field) => fieldWords(crm, field).label.toLowerCase()),
      'or',
    ),
    many: secret.length > 1,
  };
};

/** The state of a login form: the login, whether it is being tested, and why not. */
export function useConnectForm(crm: Crm | null, kept: Login = {}) {
  const [login, setLogin] = useState<Login>(() => (crm ? startingLogin(crm, kept) : {}));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return { login, setLogin, busy, setBusy, error, setError };
}

/**
 * Test a new connection's login with the CRM and save it on a yes; answers its id and the name
 * Core gave it (the brokerage's name and the CRM's).
 */
export const connect = (
  tenantId: number,
  crm: Crm,
  login: Login,
): Promise<{ id: string; name: string }> =>
  api.addConnection(tenantId, { provider: crm.provider, login });

export function ConnectFields({
  crm,
  form,
  title,
}: {
  crm: Crm;
  form: ReturnType<typeof useConnectForm>;
  title?: ReactNode;
}) {
  return (
    <>
      {title && <h2 className="k-step-title">{title}</h2>}
      <LoginFields crm={crm} login={form.login} onChange={form.setLogin} />
    </>
  );
}

/** Every field the CRM requires is there. */
export const connectReady = (crm: Crm, form: ReturnType<typeof useConnectForm>): boolean =>
  complete(crm, form.login);

/**
 * A new login for a connection (image 15), tested before it is saved, then its offices checked.
 * Opened from the brokerage's page ("Change login") and from the Inbox ("Enter new login"), which
 * first says why.
 */
export function LoginWindow({
  crm,
  connection,
  why,
  onClose,
  onDone,
}: {
  crm: Crm;
  connection: ConnectionView;
  /** The sentence before the others: "Vitec refused customer id M14582 at 06:02." */
  why?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { away } = useShell();
  const note = useNote();
  const form = useConnectForm(crm, keptLogin(crm, connection));
  const secret = secretWords(crm);
  const save = async () => {
    form.setBusy(true);
    form.setError(null);
    try {
      await api.changeLogin(connection.id, form.login);
    } catch (error) {
      if (away(error)) return;
      form.setError(loginRefusal(error, crm.name));
      form.setBusy(false);
      return;
    }
    const check = wordsFor(crm.provider).officeCheck;
    let checking = false;
    if (check && connection.actions.includes(check)) {
      checking = await api.act(connection.id, check).then(
        () => true,
        () => false,
      );
    }
    note({
      text: `${crm.name} accepted the new login for “${connection.name}”. It’s saved${checking ? ', and Core is checking its offices' : ''}.`,
    });
    onDone();
  };
  return (
    <Modal
      title={`Enter new login · ${connection.name}`}
      onClose={onClose}
      tone={why ? 'danger' : undefined}
      wide
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="k-button k-button-primary"
            disabled={form.busy || !complete(crm, form.login)}
            onClick={() => void save()}
          >
            {form.busy ? <LoaderIcon className="k-spin" size={18} /> : <PlugIcon size={18} />}
            Test and save
          </button>
        </>
      }
    >
      <p className="k-modal-text">
        {why && `${why} `}
        {secret.words &&
          `Core never shows a saved ${secret.words}, so enter ${secret.many ? 'them' : 'it'} again. `}
        Core tests the login with {crm.name} and saves it only if {crm.name} accepts it.
      </p>
      <LoginFields crm={crm} login={form.login} onChange={form.setLogin} />
      {form.error && <p className="k-error">{form.error}</p>}
    </Modal>
  );
}
