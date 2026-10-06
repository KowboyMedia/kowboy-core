// Flow (Patric, 2026-10-06): every record on its way through Core, narrowed to a tenant and an
// office, sorted by when it was queued, the top 100, read again every second.
import { useSearchParams } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { FlowList } from '@/components/flow';
import { PageHeader } from '@/components/layout';
import { ScopePicker, useScopeOptions } from '@/components/scope-picker';
import { readScope, writeScope } from '@/lib/scope';

export function Flow() {
  const [params, setParams] = useSearchParams();
  const options = useScopeOptions();
  const scope = readScope(params);

  return (
    <>
      <PageHeader
        title="Flow"
        what="Every record on its way through Core, newest first, read again every second. Narrow it to a tenant or an office; an empty box means all of them."
      />
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
          <ScopePicker
            value={scope}
            onChange={(next) => setParams(writeScope(params, next), { replace: true })}
            options={options}
            fields={['tenants', 'offices']}
          />
        </CardContent>
      </Card>
      <FlowList scope={scope} options={options} />
    </>
  );
}
