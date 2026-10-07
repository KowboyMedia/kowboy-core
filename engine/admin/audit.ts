// Who did what in the admin area (§3 F, Should). Not a page of its own: every save, rotation and
// action is an `admin.*` event with the person on it, in the one event log, and Events says it in
// a sentence that opens with the person.
import { logEvent } from '../events.js';
import type { Session } from './auth.js';

export type AuditContext = {
  tenantId?: number | null;
  connectionId?: string | null;
  subscriberId?: number | null;
  datatype?: string | null;
  remoteId?: string | null;
  /** The chain the action belongs to, such as a form's id. */
  correlationId?: string | null;
};

export function audit(
  session: Session,
  what: string,
  fields: Record<string, unknown> = {},
  context: AuditContext = {},
): Promise<void> {
  return logEvent({ type: `admin.${what}`, ...context, fields: { by: session.email, ...fields } });
}
