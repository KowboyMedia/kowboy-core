// The CRM screen (the tenant mockups, images 07 to 10, 18 and 19): which CRM, then that CRM's own
// fields as its code declares them, and Core's own forms test mode. One screen adds a connection and
// edits one: on the tenant's page, in the new-tenant steps, and from the Inbox's "Enter new login".
// Core names a new connection itself, so the screen has no name field. Every word about the CRM is
// its code's, or its name.
import { useState, type ReactNode } from 'react';
import { api, Refused, type ConnectionView, type Crm } from './api';
import { complete, LoginFields, secretTyped, startingLogin, type Login } from './LoginForm';
import { listed } from './time';
import { failureWords } from './failure';
import { Modal, Switch } from './ui';
import { AlertCircleIcon, ArrowRightIcon } from './icons';

/** A tenant's short name, as B says it: the first word of "Fyrbåk Fastigheter". */
export const shortName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** "Fyrbåk’s", "Sjöbris’". */
export const owning = (name: string): string => (name.endsWith('s') ? `${name}’` : `${name}’s`);

/** Why Core saved nothing: its sentence, and the CRM's code's own words when it gave them. */
export type Refusal = { text: string; answer: string | null };

/**
 * Why Core did not save a login, for the person who typed it (image 10): Core's sentence, and under
 * it the CRM's code's own words when Core gave them. Those words are whole sentences that say who
 * refused, whether the CRM was asked at all, and what to do, so the panel adds neither a claim that
 * the CRM refused nor advice of its own.
 */
export function loginRefusal(error: unknown, crm: string): Refusal {
  if (error instanceof Refused) {
    if (error.status === 422) {
      return error.said
        ? { text: 'Nothing is saved.', answer: error.said }
        : {
            text: `${crm} refused this login, so nothing is saved. Check the fields and try again.`,
            answer: null,
          };
    }
    if (error.status === 502) {
      return {
        text: error.said
          ? `Nothing is saved. ${error.said}`
          : `${crm} didn’t answer, so nothing is saved. Try again in a moment.`,
        answer: null,
      };
    }
    if (error.status === 400) return { text: 'Fill in every field.', answer: null };
  }
  return { text: failureWords(error), answer: null };
}

/** The CRM screen's state: the login, forms test mode, whether it is being saved, and why not. */
export function useCrmForm(crm: Crm, connection?: ConnectionView) {
  const [login, setLogin] = useState<Login>(() => startingLogin(crm, connection?.login ?? {}));
  const [formsTestMode, setFormsTestMode] = useState(connection?.formsTestMode ?? false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const saved = connection?.login ?? {};
  const changed = crm.fields.some(
    (field) => !field.secret && (login[field.key] ?? '') !== (saved[field.key] ?? ''),
  );
  return {
    login,
    setLogin,
    formsTestMode,
    setFormsTestMode,
    busy,
    setBusy,
    refusal,
    setRefusal,
    /** Every field the CRM requires is there; a saved secret may stay empty. */
    ready: complete(crm, login, connection !== undefined),
    /** Saving asks the CRM first: a new connection, a login field changed, a secret typed. */
    tests: connection === undefined || changed || secretTyped(crm, login),
  };
}

export type CrmForm = ReturnType<typeof useCrmForm>;

/** "password", or "password or key", from the secret fields the CRM's code declares. */
function secretWords(crm: Crm): { words: string; many: boolean } {
  const secret = crm.fields.filter((field) => field.secret);
  return {
    words: listed(
      secret.map((field) => field.label.toLowerCase()),
      'or',
    ),
    many: secret.length > 1,
  };
}

/** Core saved nothing (image 10): its sentence, and under it the CRM's code's own words. */
export function RefusalBox({ refusal }: { refusal: Refusal }) {
  return (
    <div className="k-refusal" role="alert">
      <AlertCircleIcon size={18} />
      <div>
        <p className="k-refusal-text">{refusal.text}</p>
        {refusal.answer && <p className="k-refusal-answer">{refusal.answer}</p>}
      </div>
    </div>
  );
}

/** The CRM's fields, then forms test mode, each part under a line, then why nothing was saved. */
export function CrmFields({
  crm,
  form,
  editing,
  title,
}: {
  crm: Crm;
  form: CrmForm;
  /** A saved connection: its secrets are not shown, and left empty they stay. */
  editing: boolean;
  title?: ReactNode;
}) {
  const secret = secretWords(crm);
  return (
    <>
      <div className="k-part">
        {title && <h2 className="k-step-title">{title}</h2>}
        <LoginFields crm={crm} login={form.login} onChange={form.setLogin} />
        {editing && secret.words && (
          <p className="k-help">
            Core never shows a saved {secret.words}, so enter {secret.many ? 'them' : 'it'} again to
            change the login. Core tests the login with {crm.name} and saves it only if {crm.name}{' '}
            accepts it. Left empty, the saved login stays.
          </p>
        )}
      </div>
      <div className="k-part">
        <Switch on={form.formsTestMode} label="Forms test mode" onChange={form.setFormsTestMode} />
        <p className="k-help">
          On: forms from the websites stop in Core and never reach {crm.name}; the website is told
          “not sent”. Nothing is sent later. For a website that is still being built.
        </p>
        {form.refusal && <RefusalBox refusal={form.refusal} />}
      </div>
    </>
  );
}

/** B's sentence beside a button that tests the login first. */
export function TestNote({ crm }: { crm: Crm }) {
  return (
    <span className="k-foot-note">
      Core tests the login with {crm.name} and saves it only if {crm.name} accepts it.
    </span>
  );
}

/**
 * Save a CRM screen: a new connection after the CRM accepts its login, or a saved one's changes.
 * Answers the connection, by its id and name, and whether the login was tested, or null when
 * nothing was saved, with why on the form.
 */
export async function saveCrm(
  form: CrmForm,
  crm: Crm,
  target: { tenantId: number } | { connection: ConnectionView },
  away: (error: unknown) => boolean,
): Promise<{ id: string; name: string; tested: boolean } | null> {
  form.setBusy(true);
  form.setRefusal(null);
  try {
    if ('tenantId' in target) {
      const added = await api.addConnection(target.tenantId, {
        provider: crm.provider,
        login: form.login,
        formsTestMode: form.formsTestMode,
      });
      return { id: added.id, name: added.name, tested: true };
    }
    const { tested } = await api.editConnection(target.connection.id, {
      login: form.login,
      formsTestMode: form.formsTestMode,
    });
    return { id: target.connection.id, name: target.connection.name, tested };
  } catch (error) {
    if (!away(error)) {
      form.setRefusal(loginRefusal(error, crm.name));
      form.setBusy(false);
    }
    return null;
  }
}

/** "Which CRM?" (images 07 and 18): every CRM Core can read, the same question however many. */
export function CrmChoice({
  crms,
  chosen,
  onChoose,
}: {
  crms: Crm[];
  chosen: string | null;
  onChoose: (provider: string) => void;
}) {
  return (
    <div className="k-field k-field-first">
      <span className="k-label" id="crm-choice">
        CRM
      </span>
      <div className="k-choice" role="radiogroup" aria-labelledby="crm-choice">
        {crms.map((crm) => (
          <button
            key={crm.provider}
            type="button"
            role="radio"
            aria-checked={chosen === crm.provider}
            className={`k-choice-option${chosen === crm.provider ? ' k-choice-on' : ''}`}
            onClick={() => onChoose(crm.provider)}
          >
            {crm.name}
          </button>
        ))}
      </div>
      <p className="k-help">The CRMs Core can read. Next come the chosen CRM’s own fields.</p>
    </div>
  );
}

/** "Add CRM · {tenant}" (image 07): which CRM, then on to its screen. */
export function AddCrmWindow({
  tenant,
  crms,
  onClose,
  onChosen,
}: {
  tenant: string;
  crms: Crm[];
  onClose: () => void;
  onChosen: (provider: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(crms[0]?.provider ?? null);
  return (
    <Modal
      title={`Add CRM · ${tenant}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="k-button k-button-link" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="k-button k-button-primary k-end"
            disabled={chosen === null}
            onClick={() => chosen && onChosen(chosen)}
          >
            <ArrowRightIcon size={18} />
            Continue
          </button>
        </>
      }
    >
      <CrmChoice crms={crms} chosen={chosen} onChoose={setChosen} />
    </Modal>
  );
}
