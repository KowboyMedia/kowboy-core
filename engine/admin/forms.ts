// Failed forms (question 160 a): the forms visitors sent that the CRM did not take, as Core keeps
// them for 30 days, with what the visitor wrote and what the CRM said, and "Send again". The list
// reads the kept forms; sending again is the forms' own send (engine/http/submissions.ts).
import { contentOf, keptSubmissions, submissionById } from '../storage/submissions.js';
import { UNANSWERED_MS } from '../http/submissions.js';
import type { Submission } from '../adapter-api/types.js';
import { audit } from './audit.js';
import type { Session } from './auth.js';

/** Refused by the CRM, not answered by it, or cut off before it answered. */
export type FailedOutcome = 'refused' | 'failed' | 'unanswered';

export type FailedForm = {
  id: string;
  tenantId: number;
  tenant: string;
  connectionId: string;
  kind: string;
  datatype: string | null;
  remoteId: string | null;
  officeId: string | null;
  outcome: FailedOutcome;
  /** The CRM's reason or the failure's cause, as the CRM or Core said it. */
  said: string | null;
  receivedAt: string;
  answeredAt: string | null;
  /** The form as the site sent it. */
  form: Submission;
};

/** Every form Core keeps that the CRM did not take, newest first. */
export async function failedForms(): Promise<FailedForm[]> {
  const rows = await keptSubmissions(UNANSWERED_MS);
  return rows.flatMap((row) => {
    const form = contentOf(row);
    if (!form) return [];
    return [
      {
        id: row.id,
        tenantId: row.tenant_id,
        tenant: row.tenant,
        connectionId: row.connection_id,
        kind: row.kind,
        datatype: row.datatype,
        remoteId: row.remote_id,
        officeId: row.office_id,
        outcome: row.outcome === 'received' ? 'unanswered' : (row.outcome as FailedOutcome),
        said: row.detail,
        receivedAt: row.received_at.toISOString(),
        answeredAt: row.outcome === 'received' ? null : (row.answered_at?.toISOString() ?? null),
        form,
      },
    ];
  });
}

/** Who sent a form again and what the CRM said, on the form's chain and its record's timeline. */
export async function auditSentAgain(session: Session, id: string, outcome: string): Promise<void> {
  const row = await submissionById(id);
  await audit(
    session,
    'form_sent_again',
    { kind: row?.kind ?? null, outcome },
    {
      tenantId: row?.tenant_id ?? null,
      connectionId: row?.connection_id ?? null,
      datatype: row?.datatype ?? null,
      remoteId: row?.remote_id ?? null,
      correlationId: id,
    },
  );
}
