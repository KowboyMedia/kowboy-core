// The CRMs list (U7). One page per adapter that registered; a second CRM appears here by itself,
// with no change to the app.
import { Link } from 'react-router';
import { useList } from '@refinedev/core';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { capital, counted, crmName, entity } from '@/lib/format';

type CrmSummary = { provider: string; datatypes: string[]; connections: number };

export function Crms() {
  const { result, query } = useList<CrmSummary>({ resource: 'crms', pagination: { mode: 'off' } });
  const rows = result?.data ?? [];

  return (
    <>
      <PageHeader
        title="CRMs"
        what="Each CRM Core can read, with its own setup directions, its settings and what it is doing."
      />
      <DataTable
        caption={`${counted(rows.length, 'CRM', 'CRMs')} that Core can read.`}
        columns={[
          {
            key: 'provider',
            header: 'CRM',
            cell: (row) => (
              <Link className="underline" to={`/crms/${row.provider}`}>
                {crmName(row.provider)}
              </Link>
            ),
          },
          { key: 'connections', header: 'Connections', cell: (row) => row.connections },
          {
            key: 'datatypes',
            header: 'What Core reads from it',
            cell: (row) => (
              <span className="flex flex-wrap gap-1">
                {row.datatypes.map((datatype) => (
                  <Badge key={datatype} tone="neutral">
                    {capital(entity(datatype, true))}
                  </Badge>
                ))}
              </span>
            ),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.provider}
        loading={query.isLoading}
        empty={<Empty what="This Core can read no CRM yet." />}
      />
    </>
  );
}
