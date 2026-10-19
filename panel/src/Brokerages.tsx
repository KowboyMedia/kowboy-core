// Tenants (design B, image 23, as the tenant mockups, image 01, change it): every tenant with its
// status, its websites and its entities, and "New tenant" in the list's head. A row opens the
// tenant's page.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, type BrokerageRow, type Status } from './api';
import { Shell, useShell } from './Shell';
import { counted } from './time';
import { ChevronRightIcon, PlusIcon } from './icons';
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
      <h1 className="k-page-title">Tenants</h1>
      {failed && <p className="k-quiet">{failed} Reload the page to try again.</p>}
      {rows && (
        <div className="k-table-box">
          <div className="k-list-head">
            <h2>
              {rows.length === 0 ? 'No tenants yet' : counted(rows.length, 'tenant', 'tenants')}
            </h2>
            <Link className="k-button k-button-quiet k-button-small" to="/new">
              <PlusIcon size={16} />
              New tenant
            </Link>
          </div>
          {rows.length === 0 && <p className="k-box-empty">Add the first one with “New tenant”.</p>}
          {rows.length > 0 && (
            <table className="k-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Status</th>
                  <th className="k-narrow">Websites</th>
                  <th className="k-narrow">Entities</th>
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
                    <td className="k-narrow">{row.entities}</td>
                    <td className="k-chevron-cell">
                      <ChevronRightIcon size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {rows && rows.length > 0 && (
        <p className="k-table-note">
          Entities: the properties, projects, agents, offices, areas and associations Core holds for
          the tenant’s websites.
        </p>
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
