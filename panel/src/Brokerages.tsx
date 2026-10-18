// Brokerages (design B, image 23): every brokerage with its status, its websites and the offices on
// them. A row opens the brokerage's page.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, type BrokerageRow, type Status } from './api';
import { Shell, useShell } from './Shell';
import { counted } from './time';
import { ChevronRightIcon } from './icons';
import { failureWords } from './failure';
import { Badge, type Tone } from './ui';

export const STATUS: Record<Status, { words: string; tone: Tone }> = {
  ok: { words: 'OK', tone: 'green' },
  look: { words: 'Needs a look', tone: 'orange' },
  off: { words: 'Off', tone: 'grey' },
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].words}</Badge>;
}

function List() {
  const navigate = useNavigate();
  const { away } = useShell();
  const [rows, setRows] = useState<BrokerageRow[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    api.brokerages().then(
      (answer) => setRows(answer.brokerages),
      (error: unknown) => {
        if (!away(error)) setFailed(failureWords(error));
      },
    );
  }, [away]);

  const open = (row: BrokerageRow) => navigate(`/brokerages/${String(row.id)}`);

  return (
    <main className="k-page">
      <h1 className="k-page-title">Brokerages</h1>
      {rows && (
        <p className="k-page-sub">
          {rows.length === 0
            ? 'No brokerages yet'
            : counted(rows.length, 'brokerage', 'brokerages')}
        </p>
      )}
      {failed && <p className="k-quiet">{failed}</p>}
      {rows && rows.length === 0 && (
        <p className="k-quiet">Add the first one with “New brokerage”.</p>
      )}
      {rows && rows.length > 0 && (
        <div className="k-table-box">
          <table className="k-table">
            <thead>
              <tr>
                <th>Brokerage</th>
                <th>Status</th>
                <th className="k-narrow">Websites</th>
                <th className="k-narrow">Offices on websites</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="k-row-link"
                  onClick={() => open(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') open(row);
                  }}
                  tabIndex={0}
                >
                  <td>
                    <div className="k-strong">{row.name}</div>
                    {row.status === 'off' && (
                      <div className="k-row-note">
                        Switched off by an admin: its websites can’t fetch data or send forms.
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="k-status-cell">
                      <StatusBadge status={row.status} />
                      {row.formsTestMode && <span className="k-tag">Forms test mode</span>}
                    </div>
                  </td>
                  <td className="k-narrow">{row.websites}</td>
                  <td className="k-narrow">{row.offices}</td>
                  <td className="k-chevron-cell">
                    <ChevronRightIcon size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

/** `/admin/brokerages`. */
export function BrokeragesPage() {
  return (
    <Shell tab="brokerages">
      <List />
    </Shell>
  );
}
