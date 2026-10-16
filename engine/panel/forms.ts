// Resending a brokerage's forms from the Inbox (design B, images 20 and 21; rows 28 to 30 and 114).
// A form Core keeps goes to the CRM again only through Core's one way back to it, "Send again"
// (http/submissions.ts), under every rule that holds there: the forms guard (forms test mode, and
// a Core that is not the live service), one send at a time, only a form the CRM did not take.
import { tenantById } from '../storage/connections.js';
import { keptSubmissions } from '../storage/submissions.js';
import { sendAgain, UNANSWERED_MS } from '../http/submissions.js';
import { NOT_LIVE } from '../registry.js';

/**
 * What became of one form: the CRM took it, refused it, did not take it (no answer, or an
 * error), the guard held it, or Core did not send it (no longer kept, or on its way already).
 */
export type Resent = {
  id: string;
  outcome: 'delivered' | 'refused' | 'failed' | 'held' | 'not-sent';
};

/**
 * Send the brokerage's kept forms that the person was shown again, oldest first, one at a time.
 * A form that is not this brokerage's, or that Core no longer keeps, is left alone. Null: no
 * such brokerage.
 */
export async function resendForms(tenantId: number, ids: string[]): Promise<Resent[] | null> {
  if (!(await tenantById(tenantId))) return null;
  const wanted = new Set(ids);
  const kept = (await keptSubmissions(UNANSWERED_MS))
    .filter(
      (row) => Number(row.tenant_id) === tenantId && wanted.has(row.id) && row.detail !== NOT_LIVE,
    )
    .sort((a, b) => a.received_at.getTime() - b.received_at.getTime());
  const results: Resent[] = [];
  for (const row of kept) {
    const sent = await sendAgain(row.id);
    if (!('answer' in sent)) {
      results.push({ id: row.id, outcome: 'not-sent' });
      continue;
    }
    const { outcome, detail } = sent.answer;
    results.push({
      id: row.id,
      outcome:
        outcome === 'delivered'
          ? 'delivered'
          : outcome === 'refused'
            ? detail === NOT_LIVE
              ? 'held'
              : 'refused'
            : 'failed',
    });
  }
  return results;
}
