// Failed forms (question 160 a): the forms visitors sent that the CRM refused or did not answer,
// as Core keeps them for 30 days, with what the visitor wrote and what was said, and a button that
// sends one again. A form the CRM takes drops its details in Core and leaves the list.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useCustomMutation, useList } from '@refinedev/core';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Confirm } from '@/components/confirm';
import { Empty } from '@/components/empty';
import { PageHeader } from '@/components/layout';
import { useScopeOptions } from '@/components/scope-picker';
import { exact } from '@/lib/format';
import { officeLabel, type ScopeOptions } from '@/lib/scope';

type Outcome = 'refused' | 'failed' | 'unanswered';

/** The form as the site sent it (schemas/submission.v1.json). */
type Form = {
  id: string;
  kind: string;
  slot_id?: string;
  person: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address?: { street?: string; postal_code?: string; city?: string };
  };
  message?: string;
  consent: { given: boolean; at: string };
  source?: { page?: string; utm?: Record<string, string> };
  criteria?: {
    object_type?: string | null;
    rooms_min?: number | null;
    living_area_min?: number | null;
    areas?: { id: string; name: string }[];
  };
  contact_about_current_home?: boolean;
};

type FailedForm = {
  id: string;
  tenantId: number;
  tenant: string;
  connectionId: string;
  kind: string;
  datatype: string | null;
  remoteId: string | null;
  officeId: string | null;
  outcome: Outcome;
  said: string | null;
  receivedAt: string;
  answeredAt: string | null;
  form: Form;
};

type Answer = { outcome: string; reference?: string | null; detail?: string | null };

const KINDS: Record<string, string> = {
  lead: 'Valuation or contact request',
  interest: 'Interest',
  viewing: 'Viewing booking',
  search_profile: 'Search profile',
};

const OUTCOMES: Record<Outcome, string> = {
  refused: 'Refused',
  failed: 'No answer',
  unanswered: 'No answer',
};

/** Why the form is here, in the words the CRM or Core gave. */
const why = (row: FailedForm): string =>
  row.outcome === 'unanswered'
    ? 'Core stopped before the CRM answered.'
    : (row.said ?? 'Nothing was said.');

export function FailedForms() {
  const options = useScopeOptions();
  const { result, query } = useList<FailedForm>({
    resource: 'forms',
    pagination: { mode: 'off' },
  });
  const rows = result?.data ?? [];

  return (
    <>
      <PageHeader
        title="Failed forms"
        what="Forms visitors sent that the CRM refused or did not answer, newest first. Core keeps each one for 30 days from when it was sent, with what the visitor wrote, so it can be sent again. A form the CRM takes leaves this list."
      />
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Looking…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="pt-4">
            <Empty what="No form is waiting. When the CRM refuses a form or does not answer, the form is listed here with what the visitor wrote." />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground" data-testid="forms-count">
            {rows.length} form(s) the CRM did not take.
          </p>
          {rows.map((row) => (
            <FormCard
              key={row.id}
              row={row}
              options={options}
              onSent={() => void query.refetch()}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FormCard({
  row,
  options,
  onSent,
}: {
  row: FailedForm;
  options: ScopeOptions;
  onSent: () => void;
}) {
  const { mutateAsync } = useCustomMutation();
  const { form } = row;
  const address = [
    form.person.address?.street,
    [form.person.address?.postal_code, form.person.address?.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  const sendAgain = async (): Promise<void> => {
    try {
      const answer = (
        await mutateAsync({
          url: `/forms/${encodeURIComponent(row.id)}/send-again`,
          method: 'post',
          values: {},
          successNotification: false,
          errorNotification: false,
        })
      ).data as unknown as Answer;
      if (answer.outcome === 'delivered') {
        toast.success(
          answer.reference
            ? `The CRM took the form, as ${answer.reference}.`
            : 'The CRM took the form.',
        );
      } else if (answer.outcome === 'refused') {
        toast.error(`Refused again: ${answer.detail ?? ''}`);
      } else {
        toast.error(`The CRM did not answer again: ${answer.detail ?? ''}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
    onSent();
  };

  return (
    <Card data-testid="failed-form">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {KINDS[row.kind] ?? row.kind}
          <Badge tone="bad">{OUTCOMES[row.outcome]}</Badge>
        </CardTitle>
        <CardDescription>
          {row.tenant}, sent {exact(row.receivedAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
          <Line label="Why">{why(row)}</Line>
          {row.datatype && row.remoteId && (
            <Line label="The home">
              <Link
                className="font-mono text-xs underline"
                to={`/records/${encodeURIComponent(row.connectionId)}/${row.datatype}/${encodeURIComponent(row.remoteId)}`}
              >
                {row.remoteId}
              </Link>
            </Line>
          )}
          <Line label="Office">{officeLabel(options, row.officeId)}</Line>
          <Line label="Name">{`${form.person.first_name} ${form.person.last_name}`}</Line>
          <Line label="E-mail">{form.person.email}</Line>
          <Line label="Phone">{form.person.phone}</Line>
          {address && <Line label="Address">{address}</Line>}
          {form.message && (
            <Line label="Message">
              <span className="whitespace-pre-wrap">{form.message}</span>
            </Line>
          )}
          {form.slot_id && <Line label="Viewing time booked">{form.slot_id}</Line>}
          {form.contact_about_current_home !== undefined && (
            <Line label="Contact about their own home">
              {form.contact_about_current_home ? 'Yes' : 'No'}
            </Line>
          )}
          {form.criteria && <Line label="Search profile">{criteriaText(form.criteria)}</Line>}
          <Line label="Consent given">{exact(form.consent.at)}</Line>
          {form.source?.page && <Line label="Sent from">{form.source.page}</Line>}
          {form.source?.utm && Object.keys(form.source.utm).length > 0 && (
            <Line label="Campaign">
              {Object.entries(form.source.utm)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')}
            </Line>
          )}
          <Line label="Form id">
            <span className="font-mono text-xs">{row.id}</span>
          </Line>
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <Confirm
            label="Send again"
            title="Send this form again"
            what={`Core sends the form to the CRM of ${row.tenant} once more, as the visitor filled it in, and shows the CRM's answer. If the CRM took it the first time without answering, it may get it twice.`}
            confirmLabel="Send it"
            variant="default"
            size="sm"
            onConfirm={sendAgain}
          />
          <span className="text-sm text-muted-foreground">
            Sends this form to the CRM again. Press it once the reason above is dealt with, for
            example when the CRM answers again.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/** A search profile in one line: what the CRM matches new homes against. */
function criteriaText(criteria: NonNullable<Form['criteria']>): string {
  const parts = [
    criteria.object_type ? `type ${criteria.object_type}` : null,
    criteria.rooms_min ? `at least ${String(criteria.rooms_min)} rooms` : null,
    criteria.living_area_min ? `at least ${String(criteria.living_area_min)} m²` : null,
    criteria.areas && criteria.areas.length > 0
      ? `in ${criteria.areas.map((area) => area.name).join(', ')}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Anything';
}
