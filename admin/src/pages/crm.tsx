// One CRM's page (U7): its setup directions, its settings, and the sections it reports, drawn with
// the same components as everything else. The app never knows what any of it means.
import { useParams } from 'react-router';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { Badge } from '@/components/ui/badge';
import {
  AdapterSections,
  Directions,
  type AdminDirections,
  type AdminSection,
} from '@/components/adapter-sections';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { useLive } from '@/lib/live';
import { capital, crmName, entity } from '@/lib/format';

type CrmPage = {
  provider: string;
  datatypes: string[];
  directions: AdminDirections;
  sections: AdminSection[];
};

export function CrmPage() {
  const { provider = '' } = useParams();
  const { result, query } = useCustom<CrmPage>({ url: `/crms/${provider}`, method: 'get' });
  const { mutateAsync } = useCustomMutation();
  useLive('crms', query.refetch);
  // An answer that has not arrived is an empty object, so the page tests a field it needs.
  const page = result?.data?.provider ? result.data : null;

  const run = async (
    action: { id: string },
    params: Record<string, string>,
  ): Promise<{ message: string }> => {
    const answer = await mutateAsync({
      url: `/crms/${provider}/act`,
      method: 'post',
      values: { action: action.id, params },
      successNotification: false,
      errorNotification: false,
    });
    await query.refetch();
    return answer.data as unknown as { message: string };
  };

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Looking…</p>;
  if (!page) return <Empty what="Core knows no CRM by that name." />;

  return (
    <>
      <PageHeader
        title={crmName(page.provider)}
        what="What this CRM needs, and what it is doing right now."
      >
        {page.datatypes.map((datatype) => (
          <Badge key={datatype} tone="neutral">
            {capital(entity(datatype, true))}
          </Badge>
        ))}
      </PageHeader>
      <div className="flex flex-col gap-4">
        <Directions directions={page.directions} />
        <AdapterSections sections={page.sections} run={run} />
      </div>
    </>
  );
}
