// What an event says, in words (Patric, 2026-09-21: a record's timeline full of payloads cannot be
// read at a glance). The engine writes the sentence, so a record's timeline carries no payload at
// all: the page is smaller, and the Events page and the timeline say the same thing about the same
// event because they both read this.
//
// Adding an event type anywhere in Core means adding its line here. The one at the bottom keeps a
// type nobody described readable rather than silent.
import type { EventFields } from '../events.js';
import { aboutCheck } from '../health.js';
import { NOT_LIVE } from '../registry.js';
import { counted, sentence } from './words.js';

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

/**
 * The things a failing check names, after its sentence: in the words the alert used, or, in an
 * event from before those were kept, as the check gave them.
 */
const names = (fields: EventFields): string => {
  const which = text(fields, 'which');
  if (which) return ` Which: ${which}.`;
  const value = fields['names'];
  return Array.isArray(value) && value.length > 0 ? ` Which: ${listed(value.map(String))}.` : '';
};

const listed = (names: string[], limit = 6): string =>
  names.length <= limit
    ? names.join(', ')
    : `${names.slice(0, limit).join(', ')} and ${String(names.length - limit)} more`;

/** A form submission by its kind, as the `submission.` events name it (docs/forms.md). */
const FORMS: Record<string, string> = {
  lead: 'a valuation or contact request',
  interest: 'an interest in the home',
  viewing: 'a viewing booking',
  search_profile: 'a search profile',
};
export const form = (fields: EventFields): string => FORMS[text(fields, 'kind') ?? ''] ?? 'a form';

/** An office by its name, then the CRM's id for it (docs/admin-panel.md, "The words it uses"). */
const office = (fields: EventFields): string => {
  const name = text(fields, 'office_name');
  const id = text(fields, 'office_id') ?? '?';
  return name
    ? `office ${name} (the CRM’s office id ${id})`
    : `the office with the CRM’s office id ${id}`;
};

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
    `${form(fields)} was delivered to the CRM${text(fields, 'reference') ? `, which gave it the id ${text(fields, 'reference') ?? ''}` : ''}`,
  'submission.refused': (fields) => {
    const reason = text(fields, 'reason');
    // Core's own answer outside production: the form never left Core.
    if (reason === NOT_LIVE) {
      return `Core held back ${form(fields)}, since only production sends forms to a CRM`;
    }
    return reason
      ? `the CRM refused ${form(fields)}, with the reason “${reason}”`
      : `the CRM refused ${form(fields)} and gave no reason`;
  },
  'submission.failed': (fields) =>
    text(fields, 'detail')
      ? `${form(fields)} could not be sent to the CRM: ${text(fields, 'detail') ?? ''}`
      : `${form(fields)} could not be sent to the CRM, and no cause was recorded`,
  bell: (fields) =>
    `rang its sites (${text(fields, 'kind') ?? 'delta'}, ${text(fields, 'status') ?? 'sent'})`,
  pull: (fields) => `a site pulled ${String(count(fields, 'items') ?? 0)} record(s)`,
  'alert.sent': (fields) => {
    const value = fields['outcomes'];
    const outcomes = Object.entries(value && typeof value === 'object' ? value : {});
    const by = (sent: boolean): string =>
      outcomes
        .filter(([, outcome]) => (outcome === 'sent') === sent)
        .map(([channel]) => (channel === 'email' ? 'mail' : 'Slack'))
        .join(' and ');
    const subject = `“${text(fields, 'subject') ?? 'an alert'}”`;
    if (outcomes.length === 0)
      return `Core had the alert ${subject} to send, but neither mail nor Slack is set up in Settings`;
    if (!by(false)) return `Core sent the alert ${subject} by ${by(true)}`;
    const failed = `could not send it by ${by(false)}; Settings shows where alerts go`;
    return by(true)
      ? `Core sent the alert ${subject} by ${by(true)}, but ${failed}`
      : `Core had the alert ${subject} to send, but ${failed}`;
  },
  'office.taken_off': (fields) =>
    `${office(fields)} was taken off the sites, with its homes and new-build projects: ${text(fields, 'reason') ?? 'no reason given'}`,
  'connection.paused': (fields) =>
    `Core stopped calling the CRM for this connection for a while, after ${counted(count(fields, 'failures') ?? 0, 'failure', 'failures')} in a row${text(fields, 'detail') ? `: ${text(fields, 'detail') ?? ''}` : ''}`,
  'connection.resumed': () => 'the connection answers again',
  'login.refused': (fields) =>
    `the CRM refuses this connection’s login, so nothing is fetched for it: ${text(fields, 'detail') ?? 'no reason given'}`,
  'check.failed': (fields) =>
    `${aboutCheck(text(fields, 'name') ?? '?').title} started failing. ${sentence(text(fields, 'detail') ?? 'No cause was recorded')}${names(fields)}`,
  'check.recovered': (fields) =>
    text(fields, 'detail')
      ? `this problem ended: ${text(fields, 'detail') ?? ''}`
      : `${aboutCheck(text(fields, 'name') ?? '?').title} passes again`,
  'job.queued': (fields) => `a run was queued (#${String(count(fields, 'job') ?? 0)})`,
  'job.done': (fields) =>
    `a run finished: ${String(count(fields, 'changed') ?? 0)} changed of ${String(count(fields, 'examined') ?? 0)}`,
  'job.failed': (fields) => `a run failed: ${text(fields, 'error') ?? 'no reason given'}`,
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
  synced: 'started a manual sync',
  crm_action: 'ran a CRM action',
  login_tried: 'tried a CRM login',
  form_sent_again: 'sent a form to the CRM again',
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
