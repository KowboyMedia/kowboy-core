// A CRM login's fields (design B, images 07 and 15): the CRM's system, then its fields, the
// username and password side by side. The fields are the ones the CRM's code declares; their words
// are B's (crm-words.ts).
import type { Crm, CrmField } from './api';
import { fieldWords, wordsFor } from './crm-words';

export type Login = Record<string, string>;

/** A new login's starting values: the system's first value, and anything kept from a saved one. */
export function startingLogin(crm: Crm, kept: Login = {}): Login {
  const login: Login = {};
  for (const field of crm.fields) {
    if (field.secret) continue;
    const value = kept[field.key];
    if (value !== undefined) login[field.key] = value;
    else if (field.options) login[field.key] = field.options[0] ?? '';
  }
  return login;
}

/** Every field the CRM's code requires is filled in. */
export const complete = (crm: Crm, login: Login): boolean =>
  crm.fields.every((field) => !field.required || (login[field.key] ?? '').trim() !== '');

function Field({
  crm,
  field,
  login,
  onChange,
  bare = false,
}: {
  crm: Crm;
  field: CrmField;
  login: Login;
  onChange: (login: Login) => void;
  bare?: boolean;
}) {
  const words = fieldWords(crm, field);
  const id = `login-${field.key}`;
  return (
    <div className="k-field">
      <label className="k-label" htmlFor={id}>
        {words.label}
      </label>
      <input
        id={id}
        className="k-input"
        type={field.secret ? 'password' : 'text'}
        autoComplete={field.secret ? 'new-password' : 'off'}
        spellCheck={false}
        value={login[field.key] ?? ''}
        onChange={(event) => onChange({ ...login, [field.key]: event.target.value })}
      />
      {!bare && words.help && <p className="k-help">{words.help}</p>}
    </div>
  );
}

export function LoginFields({
  crm,
  login,
  onChange,
}: {
  crm: Crm;
  login: Login;
  onChange: (login: Login) => void;
}) {
  const words = wordsFor(crm.provider);
  const system = words.system;
  const systemField = system ? crm.fields.find((field) => field.key === system.key) : undefined;
  const pairKeys = words.pair?.keys ?? [];
  const pair = pairKeys
    .map((key) => crm.fields.find((field) => field.key === key))
    .filter((field): field is CrmField => field !== undefined);
  const rest = crm.fields.filter((field) => field !== systemField && !pair.includes(field));
  return (
    <>
      {system && systemField?.options && (
        <div className="k-field">
          <span className="k-label" id="login-system">
            {system.label}
          </span>
          <div className="k-choice" role="radiogroup" aria-labelledby="login-system">
            {systemField.options.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={login[system.key] === value}
                className={`k-choice-option${login[system.key] === value ? ' k-choice-on' : ''}`}
                onClick={() => onChange({ ...login, [system.key]: value })}
              >
                {system.options[value]?.label ?? value}
              </button>
            ))}
          </div>
        </div>
      )}
      {rest.map((field) => (
        <Field key={field.key} crm={crm} field={field} login={login} onChange={onChange} />
      ))}
      {pair.length === 2 && (
        <div className="k-field">
          <div className="k-pair">
            {pair.map((field) => (
              <Field
                key={field.key}
                crm={crm}
                field={field}
                login={login}
                onChange={onChange}
                bare
              />
            ))}
          </div>
          {words.pair?.help && <p className="k-help">{words.pair.help}</p>}
        </div>
      )}
    </>
  );
}
