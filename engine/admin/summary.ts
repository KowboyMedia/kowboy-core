// What an event says, in words (Patric, 2026-09-21: a record's timeline full of payloads cannot be
// read at a glance). The engine writes the sentence, so a record's timeline carries no payload at
// all: the page is smaller, and the Events page and the timeline say the same thing about the same
// event because they both read this.
//
// Adding an event type anywhere in Core means adding its line here. The one at the bottom keeps a
// type nobody described readable rather than silent.
import type { EventFields } from '../events.js';

const text = (fields: EventFields, key: string): string | null => {
  const value = fields[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

const count = (fields: EventFields, key: string): number | null => {
  const value = fields[key];
  return typeof value === 'number' ? value : null;
};

/** The names of the fields a write changed, which is what a person wants from `entity.written`. */
const changedNames = (fields: EventFields): string[] => {
  const changed = fields['changed'];
  return changed && typeof changed === 'object' ? Object.keys(changed as object) : [];
};

const listed = (names: string[], limit = 6): string =>
  names.length <= limit
    ? names.join(', ')
    : `${names.slice(0, limit).join(', ')} and ${String(names.length - limit)} more`;

/** A form submission by its kind, as the `submission.` events name it (docs/forms.md). */
const FORMS: Record<string, string> = {
  lead: 'a lead',
  interest: 'an interest in the home',
  viewing: 'a viewing booking',
  search_profile: 'a search profile',
};
const form = (fields: EventFields): string =>
  FORMS[text(fields, 'kind') ?? ''] ?? 'a form submission';

const SAY: Record<string, (fields: EventFields) => string> = {
  'entity.written': (fields) => {
    const names = changedNames(fields);
    const cause = text(fields, 'cause') === 'recompute' ? 'recomputed' : 'written';
    return names.length === 0 ? `${cause}, first version` : `${cause}: ${listed(names)}`;
  },
  'entity.unchanged': () => 'fetched from the CRM, identical to what Core held',
  'entity.tombstoned': () => 'removed: the CRM no longer lists it',
  'entity.dropped': (fields) => `dropped: ${text(fields, 'reason') ?? 'Core would not take it'}`,
  'site.applied': (fields) =>
    `a site took it${text(fields, 'client') ? ` (${text(fields, 'client') ?? ''})` : ''}`,
  'site.failed': (fields) =>
    `a site could not take it: ${text(fields, 'detail') ?? 'no reason given'}`,
  'site.error': (fields) => `a site reported: ${text(fields, 'message') ?? 'an error'}`,
  'submission.received': (fields) => `a visitor sent ${form(fields)} through a site`,
  'submission.delivered': (fields) =>
    `the CRM took ${form(fields)}${text(fields, 'reference') ? ` (${text(fields, 'reference') ?? ''})` : ''}`,
  'submission.refused': (fields) =>
    `the CRM refused ${form(fields)}: ${text(fields, 'reason') ?? 'no reason given'}`,
  'submission.failed': (fields) =>
    `the CRM did not answer ${form(fields)}: ${text(fields, 'detail') ?? 'no cause given'}`,
  bell: (fields) =>
    `rang its sites (${text(fields, 'kind') ?? 'delta'}, ${text(fields, 'status') ?? 'sent'})`,
  pull: (fields) => `a site pulled ${String(count(fields, 'items') ?? 0)} record(s)`,
  'alert.sent': (fields) => `alert sent: ${text(fields, 'subject') ?? 'a check changed'}`,
  'job.queued': (fields) => `a run was queued (#${String(count(fields, 'job') ?? 0)})`,
  'job.done': (fields) =>
    `a run finished: ${String(count(fields, 'changed') ?? 0)} changed of ${String(count(fields, 'examined') ?? 0)}`,
  'job.failed': (fields) => `a run failed: ${text(fields, 'error') ?? 'no reason given'}`,
  'job.cancelled': () => 'a run was stopped',
  'engine.started': () => 'Core started',
};

/** The person behind an `admin.` event, and what they did, without its payload. */
const ADMIN: Record<string, string> = {
  sign_in_requested: 'asked for a sign-in link',
  signed_in: 'signed in',
  signed_out: 'signed out',
  devices_forgotten: 'forgot the other devices',
  tenant_saved: 'saved the tenant',
  tenant_removed: 'removed the tenant',
  token_rotated: 'made a new tenant token',
  bell_secret_rotated: 'made a new bell secret',
  rang: 'rang the sites',
  inspected: 'asked the CRM for a record',
  recompute_queued: 'started a recompute',
  fetch_again: 'asked the CRM for records again',
  housekeeping: 'ran housekeeping',
  job_cancelled: 'stopped a run',
  crm_action: 'ran a CRM action',
  login_tried: 'tried a CRM login',
  maintenance: 'changed maintenance',
};

/** One sentence for one event. Never a payload, and never longer than a line. */
export function summarise(type: string, fields: EventFields): string {
  if (type.startsWith('admin.')) {
    const what =
      ADMIN[type.slice('admin.'.length)] ?? type.slice('admin.'.length).replace(/_/g, ' ');
    const by = text(fields, 'by');
    return by ? `${by} ${what}` : what;
  }
  if (type.startsWith('lifecycle.')) {
    return `the CRM was told to ${type.slice('lifecycle.'.length).replace(/_/g, ' ')}`;
  }
  const say = SAY[type];
  if (say) return say(fields);
  // An adapter's own event: its type, read as words, is better than nothing and never a payload.
  return type.replace(/[._]/g, ' ');
}
