// Failed forms (question 160 a): the forms visitors sent that did not reach the CRM, as Core keeps
// them for 30 days, with what the visitor wrote and why, and a button that sends one again. A form
// the CRM takes drops its details in Core and leaves the list.
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
import { connectionNamed, counted, exact, listed } from '@/lib/format';
import { officeLabel, type ScopeOptions } from '@/lib/scope';

/** Refused by the CRM, held back by Core as a dry run, not sent, or cut off. */
type Outcome = 'refused' | 'held' | 'failed' | 'unanswered';

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
  /** The connection by the name a person gave it. */
  connectionName: string;
  /** The CRM the connection logs in to. */
  provider: string;
  /** The site the visitor sent it from, when Core knows it. */
  site: { id: number; name: string | null } | null;
  /** The home's address or name, when Core still holds it. */
  home: string | null;
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
  interest: 'Interest in a home',
  viewing: 'Viewing booking',
  search_profile: 'Search profile',
};

const OUTCOMES: Record<Outcome, string> = {
  refused: 'Refused by the CRM',
  held: 'Held back',
  failed: 'Could not be sent',
  unanswered: 'No answer',
};

const HELD =
  'Held back: only production sends forms to a live CRM, and never through a connection ticked to dry-run its forms, so Core kept this form here.';

/** Why the form is here, as a sentence of its own around what the CRM or Core said. */
function why(row: FailedForm): string {
  const said = row.said?.replace(/\.$/, '');
  switch (row.outcome) {
    case 'held':
      return `${HELD} Nothing needs doing.`;
    case 'unanswered':
      return 'Core was interrupted, for example by a restart, before the CRM answered. The CRM may or may not have the form.';
    case 'refused':
      return said
        ? `The CRM refused the form, with the reason “${said}”.`
        : 'The CRM refused the form and gave no reason.';
    default:
      return said
        ? `The form could not be sent: ${said}.`
        : 'The form could not be sent, and no cause was recorded.';
  }
}

/** A connection as a person reads it: its tenant and CRM, then its name. */
const connectionName = (row: FailedForm): string =>
  connectionNamed(row.connectionName, row.tenant, row.provider);

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
        what="Forms that visitors sent from a site but that were not delivered to the CRM, newest first. Until a form is sent again and delivered, the brokerage may not have that request. Core keeps what each visitor wrote for 30 days from when the form was sent, then deletes it. A form Core turned away before trying the CRM is not kept and does not show here."
      />
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Looking…</p>
      ) : query.isError ? (
        <p className="text-sm text-danger">
          Core could not read the failed forms just now. Reload the page.
        </p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="pt-4">
            <Empty what="No form is waiting to be sent again, so nothing needs doing. A form that is not delivered to the CRM shows up here for 30 days, with what the visitor wrote." />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground" data-testid="forms-count">
            {rows.length === 1
              ? 'One form from the last 30 days was not delivered.'
              : `${counted(rows.length, 'form', 'forms')} from the last 30 days were not delivered.`}
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
      const detail = answer.detail?.replace(/\.$/, '');
      if (answer.outcome === 'delivered') {
        toast.success(
          answer.reference
            ? `Delivered to the CRM, which gave the form the id ${answer.reference}. The form leaves this list.`
            : 'Delivered to the CRM. The form leaves this list.',
        );
      } else if (answer.outcome === 'held') {
        toast.error(
          'Held back again: only production sends forms to a live CRM, and never through a connection ticked to dry-run its forms. The form stays on this list.',
        );
      } else if (answer.outcome === 'refused') {
        toast.error(
          detail
            ? `The CRM refused the form again, with the reason “${detail}”. The form stays on this list.`
            : 'The CRM refused the form again and gave no reason. The form stays on this list.',
        );
      } else {
        toast.error(
          `The form could not be sent again${detail ? `: ${detail}` : ''}. The form stays on this list.`,
        );
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
          <Badge tone={row.outcome === 'held' ? 'muted' : 'bad'}>{OUTCOMES[row.outcome]}</Badge>
        </CardTitle>
        <CardDescription>
          Sent {exact(row.receivedAt)}
          {row.site?.name ? (
            <>
              {' '}
              from the site{' '}
              <Link
                className="underline"
                to={`/tenants/${String(row.tenantId)}#site:${String(row.site.id)}`}
              >
                {row.site.name}
              </Link>
            </>
          ) : (
            row.site && ' from a site since removed'
          )}
          , through{' '}
          <Link
            className="underline"
            to={`/tenants/${String(row.tenantId)}#connection:${row.connectionId}`}
          >
            {connectionName(row)}
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
          <Line label="Why">{why(row)}</Line>
          {row.datatype && row.remoteId && (
            <Line label="The home">
              <Link
                className="underline"
                to={`/records/${encodeURIComponent(row.connectionId)}/${row.datatype}/${encodeURIComponent(row.remoteId)}`}
              >
                {row.home ?? `The CRM’s id ${row.remoteId}`}
              </Link>
              {row.home
                ? `, the CRM’s id ${row.remoteId}`
                : '. Core holds no address for this home.'}
            </Line>
          )}
          <Line label="Office">
            {row.officeId === null ? (
              'Not known'
            ) : (
              <Link
                className="underline"
                to={`/records?tenant=${String(row.tenantId)}&office=${encodeURIComponent(row.officeId)}`}
              >
                {officeLabel(options, row.officeId, row.tenantId)}
              </Link>
            )}
          </Line>
          <Line label="Name">{`${form.person.first_name} ${form.person.last_name}`}</Line>
          <Line label="E-mail">{form.person.email}</Line>
          <Line label="Phone">{form.person.phone}</Line>
          {address && <Line label="Address">{address}</Line>}
          {form.message && (
            <Line label="Message">
              <span className="whitespace-pre-wrap">{form.message}</span>
            </Line>
          )}
          {form.slot_id && (
            <Line label="Viewing time chosen">
              Core does not keep the time itself; the CRM’s id for it is {form.slot_id}.
            </Line>
          )}
          {form.contact_about_current_home !== undefined && (
            <Line label="Contact about their own home">
              {form.contact_about_current_home ? 'Yes' : 'No'}
            </Line>
          )}
          {form.criteria && <Line label="Search profile">{criteriaText(form.criteria)}</Line>}
          <Line label="Agreed to be contacted">{exact(form.consent.at)}</Line>
          {form.source?.page && (
            <Line label="Sent from the page">
              <a
                className="break-all underline"
                href={form.source.page}
                target="_blank"
                rel="noopener noreferrer"
              >
                {form.source.page}
              </a>
            </Line>
          )}
          {form.source?.utm && Object.keys(form.source.utm).length > 0 && (
            <Line label="Campaign tags">{campaignText(form.source.utm)}</Line>
          )}
          <Line label="Core’s id for the form">
            <span className="font-mono text-xs">{row.id}</span>.{' '}
            <Link className="underline" to={`/events?correlation=${encodeURIComponent(row.id)}`}>
              Every step of this form is on Events.
            </Link>
          </Line>
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <Confirm
            label="Send again"
            title="Send this form again"
            what={confirmText(row)}
            confirmLabel="Send it"
            variant="default"
            size="sm"
            onConfirm={sendAgain}
          />
          <span className="text-sm text-muted-foreground">
            {row.outcome === 'held'
              ? 'Sends this form to the CRM once more. Only production sends forms to a live CRM, and never through a connection ticked to dry-run its forms, so Core holds this form back again.'
              : `Sends this form to the CRM once more, through ${connectionName(row)}, as the visitor filled it in, and shows the CRM’s answer. Press it once the cause above is fixed. If the cause cannot be fixed, leave the form, and Core deletes it 30 days after the visitor sent it.`}
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

/** The question before a send, saying how the brokerage could get the form twice. */
function confirmText(row: FailedForm): string {
  if (row.outcome === 'held')
    return 'Only production sends forms to a live CRM, and never through a connection ticked to dry-run its forms, so Core holds this form back again.';
  const kind = (KINDS[row.kind] ?? 'form').toLowerCase();
  const twice = [
    `Core sends this ${kind} to the CRM once more, through ${connectionName(row)}, as the visitor filled it in.`,
    `The brokerage may get the ${kind} twice.`,
    row.outcome === 'refused'
      ? null
      : 'The CRM may have taken the first send without Core hearing back.',
    'The visitor may also have sent the form again after being told that it did not go through.',
  ];
  return twice.filter(Boolean).join(' ');
}

const TYPES: Record<string, string> = {
  apartment: 'An apartment',
  house: 'A house',
  holiday_house: 'A holiday home',
  plot: 'A plot',
};

/** A search profile in one line: what the CRM matches new homes against. */
function criteriaText(criteria: NonNullable<Form['criteria']>): string {
  const areas = (criteria.areas ?? []).map((area) => area.name);
  const parts = [
    (criteria.object_type && TYPES[criteria.object_type]) ?? 'Any home',
    criteria.rooms_min ? `at least ${String(criteria.rooms_min)} rooms` : null,
    criteria.living_area_min ? `at least ${String(criteria.living_area_min)} m²` : null,
    areas.length > 0 ? `in ${listed(areas)}` : 'anywhere',
  ].filter(Boolean);
  return parts.join(', ');
}

const TAGS: Record<string, string> = {
  utm_source: 'source',
  utm_medium: 'medium',
  utm_campaign: 'campaign',
  utm_term: 'term',
  utm_content: 'content',
};

/** The campaign's tags in words: "source facebook, medium social". */
const campaignText = (utm: Record<string, string>): string =>
  Object.entries(utm)
    .map(([key, value]) => `${TAGS[key] ?? key.replace(/^utm_/, '').replaceAll('_', ' ')} ${value}`)
    .join(', ');
