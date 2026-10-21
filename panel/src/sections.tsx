// A CRM connection's own part of its card, opened from the line that names its offices (the tenant
// mockups, image 03): the sections its CRM's code declares, drawn as data. Every word, value and
// button in them is the code's; the panel only lays them out and presses the buttons.
import { useState } from 'react';
import {
  api,
  type ConnectionView,
  type ShownAction,
  type ShownSection,
  type ShownValue,
} from './api';
import { useShell } from './Shell';
import { failureWords } from './failure';
import { when } from './time';
import { Badge, Modal, useNote, type Tone } from './ui';
import { LoaderIcon } from './icons';

const TONES: Record<'ok' | 'bad' | 'warn' | 'muted', Tone> = {
  ok: 'green',
  bad: 'red',
  warn: 'orange',
  muted: 'grey',
};

/** One value as the code gave it: plain, a coloured state, or a moment on Stockholm's clock. */
export function Shown({ value, now }: { value: ShownValue; now: Date }) {
  if (value === null) return null;
  if (typeof value === 'boolean') return <>{value ? 'Yes' : 'No'}</>;
  if (typeof value === 'string' || typeof value === 'number') return <>{value}</>;
  if ('state' in value) return <Badge tone={TONES[value.state]}>{value.text}</Badge>;
  return <>{value.moment ? when(value.moment, now) : 'Not yet'}</>;
}

/** A button the code offers, with its sentence beside it; asked first when the code says so. */
function Action({
  connection,
  action,
  onDone,
}: {
  connection: ConnectionView;
  action: ShownAction;
  onDone: () => void;
}) {
  const { away } = useShell();
  const note = useNote();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const run = async () => {
    setAsking(false);
    setBusy(true);
    try {
      const { message } = await api.act(connection.id, action.id);
      if (message) note({ text: message });
      onDone();
    } catch (error) {
      if (!away(error)) note({ text: failureWords(error), icon: 'warn' });
    }
    setBusy(false);
  };
  return (
    <div className="k-own-action">
      {action.help && <p className="k-own-help">{action.help}</p>}
      <button
        type="button"
        className={`k-button k-button-small ${action.danger ? 'k-button-danger' : 'k-button-quiet'}`}
        disabled={busy}
        onClick={() => (action.confirm ? setAsking(true) : void run())}
      >
        {busy && <LoaderIcon className="k-spin" size={14} />}
        {action.label}
      </button>
      {asking && (
        <Modal
          title={`${action.label}?`}
          tone={action.danger ? 'danger' : undefined}
          onClose={() => setAsking(false)}
          footer={
            <>
              <button
                type="button"
                className="k-button k-button-link"
                onClick={() => setAsking(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`k-button ${action.danger ? 'k-button-danger' : 'k-button-primary'}`}
                onClick={() => void run()}
              >
                {action.label}
              </button>
            </>
          }
        >
          <p className="k-modal-text">{action.confirm}</p>
        </Modal>
      )}
    </div>
  );
}

function Section({
  connection,
  section,
  titled,
  now,
  onDone,
}: {
  connection: ConnectionView;
  section: ShownSection;
  /** The line that opens the sections says the first one's title already. */
  titled: boolean;
  now: Date;
  onDone: () => void;
}) {
  const table = section.table;
  return (
    <div className="k-own">
      {titled && <h3 className="k-own-title">{section.title}</h3>}
      {table && table.rows.length > 0 && (
        <div className="k-own-scroll">
          <table className="k-table k-table-plain">
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, at) => (
                    <td key={at} className={at === 0 ? 'k-strong' : undefined}>
                      <Shown value={cell} now={now} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {table && table.rows.length === 0 && table.empty && (
        <p className="k-own-line">{table.empty}</p>
      )}
      {section.help && <p className="k-own-line">{section.help}</p>}
      {section.items.map((item) => (
        <p key={item.label} className="k-own-line">
          {item.label}: <Shown value={item.value} now={now} />
        </p>
      ))}
      {section.actions.map((action) => (
        <Action key={action.id} connection={connection} action={action} onDone={onDone} />
      ))}
    </div>
  );
}

/** Everything the CRM's code shows of a connection, or what failed when it could not. */
export function ConnectionSections({
  connection,
  opener,
  now,
  onDone,
}: {
  connection: ConnectionView;
  /** The word on the line that opens them, so a first section with that title is not titled again. */
  opener: string;
  now: Date;
  onDone: () => void;
}) {
  return (
    <div className="k-owns">
      {connection.sectionsFailed && <p className="k-error">{connection.sectionsFailed}</p>}
      {connection.sections.map((section, index) => (
        <Section
          key={`${section.title} ${String(index)}`}
          connection={connection}
          section={section}
          titled={index > 0 || section.title.trim().toLowerCase() !== opener.toLowerCase()}
          now={now}
          onDone={onDone}
        />
      ))}
    </div>
  );
}
