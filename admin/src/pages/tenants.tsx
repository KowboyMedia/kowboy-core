// The tenants list (U1, U6): tenants only. A connection is never a row here, nor anywhere else —
// it is a setting of the tenant, on the tenant's page (Patric's rule 1).
import { Link } from 'react-router';
import { useList } from '@refinedev/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { ago, count, counted } from '@/lib/format';

type TenantSummary = {
  id: number;
  displayName: string;
  active: boolean;
  connections: number;
  sites: number;
  records: number;
  lastPullAt: string | null;
};

export function Tenants() {
  const { result, query } = useList<TenantSummary>({
    resource: 'tenants',
    pagination: { mode: 'off' },
  });
  const rows = result?.data ?? [];

  return (
    <>
      <PageHeader
        title="Tenants"
        what="Every customer of Kowboy, with its CRM connections and its sites. Open a tenant to change it."
      >
        <span className="max-w-xs text-sm text-muted-foreground">
          Adds a customer: you name it, add its CRM connection and its sites, then save.
        </span>
        <Button asChild>
          <Link to="/tenants/new">New tenant</Link>
        </Button>
      </PageHeader>

      <DataTable
        caption={counted(rows.length, 'tenant', 'tenants')}
        columns={[
          {
            key: 'name',
            header: 'Tenant',
            cell: (row) => (
              <Link className="underline" to={`/tenants/${String(row.id)}`}>
                {row.displayName}
              </Link>
            ),
          },
          { key: 'id', header: 'Number', cell: (row) => row.id },
          {
            key: 'active',
            header: 'Enabled',
            cell: (row) => (
              <Badge tone={row.active ? 'ok' : 'muted'}>{row.active ? 'Yes' : 'No'}</Badge>
            ),
          },
          { key: 'connections', header: 'CRM connections', cell: (row) => row.connections },
          { key: 'sites', header: 'Sites', cell: (row) => row.sites },
          {
            key: 'records',
            header: 'Records',
            cell: (row) => <span className="tabular-nums">{count(row.records)}</span>,
          },
          { key: 'pull', header: 'A site last fetched', cell: (row) => ago(row.lastPullAt) },
        ]}
        rows={rows}
        rowKey={(row) => String(row.id)}
        loading={query.isLoading}
        empty={
          <Empty
            what="No tenant yet. A tenant is one customer of Kowboy: its CRM connection and the sites that show its listings."
            next={
              <Button asChild size="sm">
                <Link to="/tenants/new">Make the first tenant</Link>
              </Button>
            }
          />
        }
      />
    </>
  );
}
