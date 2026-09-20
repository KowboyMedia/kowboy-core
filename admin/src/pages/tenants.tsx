// Tenants: every customer, what it is connected to, and how it is doing. One page makes and
// changes a tenant (tenant.tsx).
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusIcon } from 'lucide-react';
import { tenantsQuery } from '@/api/queries';
import type { TenantListRow } from '@/api/types';
import { PageHeader } from '@/components/page';
import { DataTable } from '@/components/data-table';
import { Moment } from '@/components/moment';
import { YesNo } from '@/components/state-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fmtNumber } from '@/lib/format';

export function TenantsPage() {
  const navigate = useNavigate();
  const tenants = useQuery(tenantsQuery());
  const [text, setText] = useState('');
  const rows = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return (tenants.data ?? []).filter(
      (row) =>
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        String(row.id) === needle.replace(/^#/, '') ||
        (row.provider ?? '').includes(needle),
    );
  }, [tenants.data, text]);
  const columns: ColumnDef<TenantListRow, unknown>[] = [
    {
      id: 'id',
      header: '#',
      cell: ({ row }) => <span className="tabular-nums">{row.original.id}</span>,
    },
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          to={`/tenants/${row.original.id}`}
          className="font-medium text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: 'active',
      header: 'Licence',
      cell: ({ row }) => <YesNo value={row.original.active} yes="active" no="disabled" />,
    },
    {
      id: 'provider',
      header: 'CRM',
      cell: ({ row }) =>
        row.original.provider ? (
          <span>
            {row.original.provider}{' '}
            {!row.original.has_credentials && <Badge variant="warn">no login</Badge>}
          </span>
        ) : (
          <span className="text-muted-foreground">none</span>
        ),
    },
    {
      id: 'offices',
      header: 'Offices',
      cell: ({ row }) => <span className="tabular-nums">{row.original.offices}</span>,
    },
    {
      id: 'sites',
      header: 'Sites',
      cell: ({ row }) => <span className="tabular-nums">{row.original.sites}</span>,
    },
    {
      id: 'records',
      header: 'Live records',
      cell: ({ row }) => <span className="tabular-nums">{fmtNumber(row.original.records)}</span>,
    },
    {
      id: 'last_ingest_at',
      header: 'Last write from the CRM',
      cell: ({ row }) => <Moment at={row.original.last_ingest_at} ago />,
    },
    {
      id: 'last_error',
      header: 'Last error',
      cell: ({ row }) =>
        row.original.last_error ? (
          <span className="text-bad">{row.original.last_error}</span>
        ) : (
          <span className="text-muted-foreground">none</span>
        ),
    },
    {
      id: 'created_at',
      header: 'Made',
      cell: ({ row }) => <Moment at={row.original.created_at} />,
    },
  ];
  return (
    <>
      <PageHeader
        title="Tenants"
        intro="Every customer: its licence, its CRM connection, its sites and its records. Open one to change it; everything about a customer is made on its page."
        actions={
          <Button asChild>
            <Link to="/tenants/new">
              <PlusIcon /> New tenant
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowId={(row) => String(row.id)}
        loading={tenants.isPending}
        empty={
          text ? 'No tenant matches.' : 'No tenants yet. Press “New tenant” to make the first one.'
        }
        rowLink={(row) => navigate(`/tenants/${row.id}`)}
        defaultHidden={['created_at']}
        toolbar={
          <Input
            placeholder="Find by name, number or CRM…"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="max-w-xs"
            aria-label="Find a tenant"
          />
        }
      />
    </>
  );
}
