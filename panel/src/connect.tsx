// Connecting a brokerage to a CRM, and entering a new login (design B, images 07 and 15): the
// connection's name and the CRM's login, which Core tests with the CRM and saves only if the CRM
// accepts it.
import { useState, type ReactNode } from 'react';
import { api, Refused, type ConnectionView, type Crm } from './api';
import { complete, LoginFields, startingLogin, type Login } from './LoginForm';
import { fieldWords } from './crm-words';
import { listed } from './time';
import { UNANSWERED } from './ui';

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
  return UNANSWERED;
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

/** The state of a login form: the name, the login, whether it is being tested, and why not. */
export function useConnectForm(crm: Crm | null, name: string, kept: Login = {}) {
  const [connectionName, setName] = useState(name);
  const [login, setLogin] = useState<Login>(() => (crm ? startingLogin(crm, kept) : {}));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return { connectionName, setName, login, setLogin, busy, setBusy, error, setError };
}

/** Test a new connection's login with the CRM and save it on a yes; answers its id. */
export async function connect(
  tenantId: number,
  crm: Crm,
  name: string,
  login: Login,
): Promise<string> {
  const { id } = await api.addConnection(tenantId, {
    provider: crm.provider,
    name: name.trim(),
    login,
  });
  return id;
}

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
      <div className="k-field">
        <label className="k-label" htmlFor="connection-name">
          Name
        </label>
        <input
          id="connection-name"
          className="k-input"
          value={form.connectionName}
          onChange={(event) => form.setName(event.target.value)}
        />
        <p className="k-help">Shown in Core’s lists. You can change it later.</p>
      </div>
      <LoginFields crm={crm} login={form.login} onChange={form.setLogin} />
    </>
  );
}

/** The name and every field the CRM requires are there. */
export const connectReady = (crm: Crm, form: ReturnType<typeof useConnectForm>): boolean =>
  form.connectionName.trim() !== '' && complete(crm, form.login);
