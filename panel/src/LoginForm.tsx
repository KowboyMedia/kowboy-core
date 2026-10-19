// A CRM login's fields (design B, images 07 and 15, and the tenant mockups 08 to 10), drawn only
// from what the CRM's code declares, in its order and in its words: a field with fixed values is a
// choice of its options, any other is typed. A field without help followed by a secret field sit
// side by side, with the secret's help under both, as B drew a username and its password. The
// panel holds no word of any CRM.
import type { Crm, CrmField } from './api';

export type Login = Record<string, string>;

/** A login's starting values: anything kept from a saved one, else a choice's first option. */
export function startingLogin(crm: Crm, kept: Login = {}): Login {
  const login: Login = {};
  for (const field of crm.fields) {
    if (field.secret) continue;
    const value = kept[field.key];
    if (value !== undefined) login[field.key] = value;
    else if (field.options) login[field.key] = field.options[0]?.value ?? '';
  }
  return login;
}

/**
 * Every field the CRM's code requires is filled in. Editing a saved login, a secret field may stay
 * empty: Core keeps the saved one.
 */
export const complete = (crm: Crm, login: Login, saved = false): boolean =>
  crm.fields.every(
    (field) => !field.required || (saved && field.secret) || (login[field.key] ?? '').trim() !== '',
  );

/** A secret field is typed in: the login changes, so Core tests it with the CRM. */
export const secretTyped = (crm: Crm, login: Login): boolean =>
  crm.fields.some((field) => field.secret && (login[field.key] ?? '').trim() !== '');

type Change = (login: Login) => void;

function Choice({ field, login, onChange }: { field: CrmField; login: Login; onChange: Change }) {
  const id = `login-${field.key}`;
  return (
    <div className="k-field">
      <span className="k-label" id={id}>
        {field.label}
      </span>
      <div className="k-choice" role="radiogroup" aria-labelledby={id}>
        {(field.options ?? []).map((option) => {
          const on = login[field.key] === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={`k-choice-option${on ? ' k-choice-on' : ''}`}
              onClick={() => onChange({ ...login, [field.key]: option.value })}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {field.help && <p className="k-help">{field.help}</p>}
    </div>
  );
}

function Typed({
  field,
  login,
  onChange,
  bare = false,
}: {
  field: CrmField;
  login: Login;
  onChange: Change;
  /** Its help goes under the pair it stands in, not under it. */
  bare?: boolean;
}) {
  const id = `login-${field.key}`;
  return (
    <div className={bare ? undefined : 'k-field'}>
      <label className="k-label" htmlFor={id}>
        {field.label}
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
      {!bare && field.help && <p className="k-help">{field.help}</p>}
    </div>
  );
}

/** The fields in the code's order, a field without help and the secret after it as one pair. */
function grouped(fields: CrmField[]): CrmField[][] {
  const groups: CrmField[][] = [];
  for (let at = 0; at < fields.length; at += 1) {
    const field = fields[at];
    const next = fields[at + 1];
    if (!field) continue;
    if (!field.options && !field.secret && !field.help && next?.secret && !next.options) {
      groups.push([field, next]);
      at += 1;
    } else {
      groups.push([field]);
    }
  }
  return groups;
}

export function LoginFields({
  crm,
  login,
  onChange,
}: {
  crm: Crm;
  login: Login;
  onChange: Change;
}) {
  return (
    <>
      {grouped(crm.fields).map((group) => {
        const [first, second] = group;
        if (!first) return null;
        if (!second) {
          return first.options ? (
            <Choice key={first.key} field={first} login={login} onChange={onChange} />
          ) : (
            <Typed key={first.key} field={first} login={login} onChange={onChange} />
          );
        }
        return (
          <div key={first.key} className="k-field">
            <div className="k-pair">
              <Typed field={first} login={login} onChange={onChange} bare />
              <Typed field={second} login={login} onChange={onChange} bare />
            </div>
            {second.help && <p className="k-help">{second.help}</p>}
          </div>
        );
      })}
    </>
  );
}
