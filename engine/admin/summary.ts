// What an event says, in words (Patric, 2026-09-21: a record's timeline full of payloads cannot be
// read at a glance). The engine writes the sentence, so a record's timeline carries no payload at
// all: the page is smaller, and the Events page and the timeline say the same thing about the same
// event because they both read this. Each sentence is written for a cold reader (AGENTS.md,
// definition of done 5): whole sentences, the things named as the admin area names them, never a
// type, a field's name or a code word.
//
// Adding an event type anywhere in Core means adding its line here. The one at the bottom keeps a
// type nobody described readable rather than silent.
import { db } from '../storage/db.js';
import type { EventFields, EventRow } from '../events.js';
import { aboutCheck } from '../health.js';
import { NOT_LIVE } from '../registry.js';
import { TOMBSTONE_RETENTION_DAYS } from '../version.js';
import {
  anEntity,
  capital,
  clock,
  connectionNamed,
  counted,
  crmName,
  entity,
  inSentence,
  inWords,
  lasting,
  listed,
  number,
  officeNamed,
  sentence,
  siteNamed,
} from './words.js';

/**
 * The names a sentence uses that an event's fields do not carry, read from its row (`namedFor`).
 * Without them a sentence still reads, with "a site", "the CRM" or "this connection" in their place.
 */
export type Named = {
  /** The tenant's name. */
  tenant?: string | null;
  /** The site's name, as its tenant's page names it. */
  site?: string | null;
  /** The connection in words: "Acme’s Somecrm connection “Main”". */
  connection?: string | null;
  /** The CRM's name: "Somecrm". */
  crm?: string | null;
  /** The record's entity type, as the row names it: "property". */
  datatype?: string | null;
};

const text = (fields: EventFields, key: string): string | null => {
  const value = fields[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

const count = (fields: EventFields, key: string): number | null => {
  const value = fields[key];
  return typeof value === 'number' ? value : null;
};

const strings = (fields: EventFields, key: string): string[] => {
  const value = fields[key];
  return Array.isArray(value) ? value.map(String) : [];
};

/** A detail the CRM's code or a site wrote, quoted and kept to a line. */
const quoted = (value: string, limit = 300): string =>
  `“${value.length > limit ? `${value.slice(0, limit - 1)}…` : value}”`;

/** The names of the fields a write changed, which is what a person wants from `entity.written`. */
const changedNames = (fields: EventFields): string[] => {
  const changed = fields['changed'];
  return changed && typeof changed === 'object' ? Object.keys(changed as object) : [];
};

const theSite = (named: Named): string => (named.site ? `the site ${named.site}` : 'a site');
const theCrm = (named: Named): string => named.crm ?? 'the CRM';
const theConnection = (named: Named): string => named.connection ?? 'this connection';
const tenantsPage = (named: Named): string =>
  named.tenant ? `${named.tenant}’s page` : 'its tenant’s page';

/** A form by its kind, as the `submission.` events name it (docs/forms.md). */
const FORMS: Record<string, string> = {
  lead: 'a valuation or contact request',
  interest: 'an interest in the home',
  viewing: 'a viewing booking',
  search_profile: 'a search profile',
};
export const form = (fields: EventFields): string => FORMS[text(fields, 'kind') ?? ''] ?? 'a form';

/** A record saved: the first time, a new version and how much of it changed, or its rules again. */
function written(fields: EventFields, named: Named): string {
  const changed = changedNames(fields).length;
  const fieldsChanged = inWords(changed, 'field', 'fields');
  if (text(fields, 'cause') === 'recompute') return `Recomputed, with ${fieldsChanged} changed.`;
  if (fields['old_hash'] === null) return 'Saved for the first time.';
  if (changed > 0)
    return `Saved a new version from ${theCrm(named)}, with ${fieldsChanged} changed.`;
  // The same content saved again is a new version of Core's rules; content that differs only
  // where no field is compared is the fields Core keeps for this one CRM (ingest.ts).
  return fields['old_hash'] === fields['new_hash']
    ? 'Saved again with no field changed, because Core’s rules changed since it was last saved.'
    : `Saved a new version from ${theCrm(named)}, in which only fields particular to this CRM changed.`;
}

/** A record Core would not save, and why, by the reason `ingest.ts` gives. */
function dropped(fields: EventFields, named: Named): string {
  const reason = text(fields, 'reason');
  if (reason === 'malformed') {
    const what = text(fields, 'detail') ?? (listed(strings(fields, 'errors')) || null);
    const record = named.datatype ? anEntity(named.datatype) : 'a record';
    return `Not saved, because what ${theCrm(named)} sent does not fit what Core expects of ${record}. The sites keep what they had.${what ? ` What did not fit: ${quoted(what)}.` : ''}`;
  }
  if (reason === 'unlicensed') {
    const office = text(fields, 'office_id');
    return `Not saved, because it belongs to ${office ? officeNamed(office) : 'an office'}, which ${theConnection(named)} does not fetch.`;
  }
  if (reason === 'unknown-datatype') {
    const kind = named.datatype ? entity(named.datatype, true) : 'records of this kind';
    return `Not saved, because Core takes no ${kind} from ${theCrm(named)}.`;
  }
  return reason ? sentence(`Not saved: ${reason}`) : 'Not saved. Core gave no reason.';
}

/** Core telling one site about changes, and how the site answered (`bells.ts`). */
function told(fields: EventFields, named: Named): string {
  const what = `${theSite(named)} ${text(fields, 'kind') === 'forcerefresh' ? 'to fetch everything again' : 'about changes'}`;
  const status = text(fields, 'status');
  if (status === 'ok') return `Core told ${what}, and the site answered.`;
  if (status === 'failed') return `Core tried to tell ${what}, and the site did not answer.`;
  const code = /^http (\d+)$/.exec(status ?? '')?.[1];
  if (code === '401' || code === '403') {
    return `Core told ${what}, and the site refused the call. The bell secret in the site’s Core settings most likely differs from the one on ${tenantsPage(named)}.`;
  }
  if (code) return `Core told ${what}, and the site answered with an error, code ${code}.`;
  return `Core told ${what}.`;
}

/** An alert, and by which channel it went or could not go. */
function alerted(fields: EventFields): string {
  const value = fields['outcomes'];
  const outcomes = Object.entries(value && typeof value === 'object' ? value : {});
  const by = (sent: boolean, joint: string): string => {
    const ways = outcomes
      .filter(([, outcome]) => (outcome === 'sent') === sent)
      .map(([channel]) => (channel === 'email' ? 'by mail' : 'to Slack'));
    return ways.length > 1
      ? `${ways.slice(0, -1).join(', ')} ${joint} ${ways.at(-1) ?? ''}`
      : ways.join('');
  };
  const alert = `the alert “${text(fields, 'subject') ?? 'without a subject'}”`;
  if (outcomes.length === 0) {
    return `Core had ${alert} to send, but neither mail nor Slack is set up for alerts. Settings shows where alerts go.`;
  }
  if (!by(false, 'or')) return `Core sent ${alert} ${by(true, 'and')}.`;
  const failed = `could not send it ${by(false, 'or')}. Settings shows where alerts go.`;
  return by(true, 'and')
    ? `Core sent ${alert} ${by(true, 'and')}, but ${failed}`
    : `Core had ${alert} to send, but ${failed}`;
}

/** A problem a check found, in the words the alert kept: its sentences, and the thing it concerns. */
function problem(fields: EventFields): string {
  const title = aboutCheck(text(fields, 'name') ?? '?').title;
  const said = text(fields, 'detail');
  const which = text(fields, 'which') ?? (listed(strings(fields, 'names').map(inSentence)) || null);
  const concerns = which && !(said ?? '').includes(which) ? ` It concerns ${which}.` : '';
  return `The check “${title}” found a problem. ${said ? sentence(said) : 'No cause was recorded.'}${concerns}`;
}

/** A problem that ended, quoting how it began. */
function resolved(fields: EventFields): string {
  const lasted = count(fields, 'lasted_ms');
  const after = lasted === null ? '' : ` after ${lasting(lasted)}`;
  const said = text(fields, 'said');
  if (said) return `Resolved${after}: “${said}” Nothing to do.`;
  // One kept before the words were: the check's title, and the thing it concerned.
  const detail = text(fields, 'detail');
  if (detail) return `Resolved${after}: ${detail}. Nothing to do.`;
  return `The check “${aboutCheck(text(fields, 'name') ?? '?').title}” passes again${after}. Nothing to do.`;
}

type ScopeKept = Record<string, unknown>;

/** One field of a kept scope, single or a list, as strings. */
const scopeList = (scope: ScopeKept, one: string, many: string): string[] => [
  ...(typeof scope[one] === 'string' || typeof scope[one] === 'number' ? [String(scope[one])] : []),
  ...(Array.isArray(scope[many]) ? (scope[many] as unknown[]).map(String) : []),
];

/** Which records a scope takes: one by its id, the entity types, or every record. */
function scopeRecords(scope: ScopeKept): string {
  if (typeof scope['remoteId'] === 'string')
    return `the record with the CRM’s id ${scope['remoteId']}`;
  const datatypes = scopeList(scope, 'datatype', 'datatypes');
  return datatypes.length > 0
    ? `the ${listed(datatypes.map((datatype) => entity(datatype, true)))}`
    : 'every record';
}

/** Whose records a scope takes: the offices, then the tenants or the connection, or all of Core. */
function scopeOwners(scope: ScopeKept, named: Named): string[] {
  const offices = scopeList(scope, 'officeId', 'officeIds');
  const tenants = scopeList(scope, 'tenantId', 'tenantIds');
  const owners =
    offices.length > 0
      ? [
          offices.length === 1
            ? `of the office with the CRM’s office id ${offices[0] ?? ''}`
            : `of the offices with the CRM’s office ids ${listed(offices)}`,
        ]
      : [];
  if (tenants.length === 1 && named.tenant) return [...owners, `of ${named.tenant}`];
  if (tenants.length > 0) return [...owners, `of ${inWords(tenants.length, 'tenant', 'tenants')}`];
  if (typeof scope['connectionId'] === 'string') return [...owners, `of ${theConnection(named)}`];
  return owners.length > 0 || typeof scope['remoteId'] === 'string' ? owners : ['in Core'];
}

/** A recompute's scope, as the job keeps it, in words: "the homes of Acme", "every record in Core". */
function scopeWords(value: unknown, named: Named): string {
  const scope = (value && typeof value === 'object' ? value : {}) as ScopeKept;
  if (Array.isArray(scope['keys']) && scope['keys'].length > 0) {
    return inWords(scope['keys'].length, 'record picked by name', 'records picked by name');
  }
  return [scopeRecords(scope), ...scopeOwners(scope, named)].join(' ');
}

/** A recompute that finished: how many records it worked out again, and how many changed. */
function recomputed(fields: EventFields): string {
  const examined = number(count(fields, 'examined') ?? 0);
  const changed = number(count(fields, 'changed') ?? 0);
  const failed = count(fields, 'failed') ?? 0;
  return [
    fields['dry_run'] === true
      ? `The trial recompute is done: ${changed} of the ${examined} records it worked out again would change.`
      : `The recompute is done: ${changed} of the ${examined} records it worked out again changed.`,
    failed > 0 && `${capital(inWords(failed, 'record', 'records'))} could not be worked out again.`,
  ]
    .filter((part) => part)
    .join(' ');
}

/** What the admin area asked of a connection's CRM code (`lifecycle.ts`), by the task's type. */
function lifecycle(task: string, fields: EventFields, named: Named): string {
  const crm = theCrm(named);
  const connection = theConnection(named);
  const offices = strings(fields, 'office_ids');
  const which =
    offices.length === 1
      ? `the office with the CRM’s office id ${offices[0] ?? ''} was`
      : `the offices with the CRM’s office ids ${listed(offices, offices.length)} were`;
  const records = count(fields, 'records');
  const datatype = text(fields, 'datatype');
  switch (task) {
    case 'connection_added':
      return `Core began loading the records of ${connection} from ${crm}.`;
    case 'connection_removed':
      return `${capital(connection)} was removed, and its records with it. Each site takes them off when it next fetches its changes.`;
    case 'offices_added':
      return `${capital(which)} added to ${connection}, and Core began loading their records from ${crm}.`;
    case 'offices_removed':
      return `${capital(which)} taken off ${connection}, and their records with them. Each site takes them off when it next fetches its changes.`;
    case 'resync':
      return `Core began fetching ${datatype ? `the ${entity(datatype, true)}` : 'every record'} of ${connection} from ${crm} again.`;
    case 'refetch':
      return `Core began fetching ${records === null ? 'some records' : inWords(records, 'record', 'records')} of ${connection} from ${crm} again. A record ${crm} no longer has is removed.`;
    default:
      return `Core handed the task “${task.replace(/_/g, ' ')}” to the part of Core that talks to ${crm}.`;
  }
}

const SAY: Record<string, (fields: EventFields, named: Named) => string> = {
  'entity.written': written,
  'entity.unchanged': (_, named) =>
    `Fetched from ${theCrm(named)} again, with nothing changed. No site was told.`,
  'entity.tombstoned': () =>
    `Removed from the sites. Each site takes it off when it next fetches its changes, and Core keeps the removed record for ${String(TOMBSTONE_RETENTION_DAYS)} days.`,
  'entity.dropped': dropped,
  'site.applied': (_, named) => `${capital(theSite(named))} took this version.`,
  'site.failed': (fields, named) => {
    const detail = text(fields, 'detail');
    return detail
      ? `${capital(theSite(named))} could not take this version. The site said: ${quoted(detail)}.`
      : `${capital(theSite(named))} could not take this version and gave no reason.`;
  },
  'site.error': (fields, named) => {
    const message = text(fields, 'message');
    return message
      ? `${capital(theSite(named))} reported an error: ${quoted(message)}.`
      : `${capital(theSite(named))} reported an error without saying what.`;
  },
  'submission.received': (fields, named) =>
    `A visitor sent ${form(fields)} from ${theSite(named)}.`,
  'submission.delivered': (fields, named) => {
    const reference = text(fields, 'reference');
    return `${capital(form(fields))} was delivered to ${theCrm(named)}${reference ? `, which gave it the id ${reference}` : ''}.`;
  },
  'submission.refused': (fields, named) => {
    const reason = text(fields, 'reason');
    // Core's own answer outside production: the form never left Core.
    if (reason === NOT_LIVE) {
      return `Core held back ${form(fields)}, since only production sends forms to a live CRM.`;
    }
    return reason
      ? `${capital(theCrm(named))} refused ${form(fields)}, with the reason “${reason}”.`
      : `${capital(theCrm(named))} refused ${form(fields)} and gave no reason.`;
  },
  'submission.failed': (fields, named) => {
    const detail = text(fields, 'detail');
    return detail
      ? sentence(`${capital(form(fields))} could not be sent to ${theCrm(named)}: ${detail}`)
      : `${capital(form(fields))} could not be sent to ${theCrm(named)}, and no cause was recorded.`;
  },
  bell: told,
  pull: (fields, named) => {
    const items = count(fields, 'items') ?? 0;
    const site = capital(theSite(named));
    if (items === 0) return `${site} fetched its changes, and there were none.`;
    const records = named.datatype
      ? `${number(items)} ${entity(named.datatype, items !== 1)}`
      : counted(items, 'record', 'records');
    return `${site} fetched the changes to ${records}.`;
  },
  'alert.sent': alerted,
  'office.taken_off': (fields, named) => {
    const office = officeNamed(
      text(fields, 'office_id') ?? '?',
      text(fields, 'office_name'),
      named.tenant,
    );
    const reason = text(fields, 'reason');
    return `${capital(office)} was taken off the sites, with its homes and new-build projects. ${reason ? sentence(reason) : 'No reason was recorded.'}`;
  },
  'connection.paused': (fields, named) => {
    const failures = count(fields, 'failures');
    const until = text(fields, 'until');
    const detail = text(fields, 'detail');
    const connection = theConnection(named);
    const stopped = failures
      ? `${connection} after ${inWords(failures, 'call', 'calls')} in a row failed`
      : connection;
    return [
      `Core stopped asking ${theCrm(named)} for ${stopped}, and asks again by itself ${until ? `at ${clock(new Date(until))}` : 'later'}.`,
      `No change from ${theCrm(named)} reaches the sites through it meanwhile.`,
      detail && `The last failure: ${quoted(detail)}.`,
    ]
      .filter((part) => part)
      .join(' ');
  },
  'connection.resumed': (_, named) =>
    `${capital(theCrm(named))} answers again for ${theConnection(named)}, so Core fetches for it as before.`,
  'login.refused': (fields, named) => {
    const detail = text(fields, 'detail');
    return `${capital(theCrm(named))} refuses the login of ${theConnection(named)}, so Core fetches nothing for it.${detail ? ` ${sentence(detail)}` : ''}`;
  },
  'check.failed': problem,
  'check.recovered': resolved,
  'job.queued': (fields, named) =>
    fields['dry_run'] === true
      ? `A trial recompute of ${scopeWords(fields['scope'], named)} was asked for. It works the records out again to show what would change, and saves nothing.`
      : `A recompute of ${scopeWords(fields['scope'], named)} was asked for. Core runs one recompute at a time, in the order asked.`,
  'job.done': recomputed,
  'job.failed': (fields) => {
    const error = text(fields, 'error');
    return [
      fields['dry_run'] === true
        ? 'The trial recompute stopped before it was done.'
        : 'The recompute stopped before it was done. The records it had worked out again keep their new version; ask for the rest again on Manual sync.',
      error && `What failed: ${quoted(error)}.`,
    ]
      .filter((part) => part)
      .join(' ');
  },
  'engine.started': (fields) =>
    text(fields, 'version')
      ? `Core started, version ${text(fields, 'version') ?? ''}.`
      : 'Core started.',

  // The adapters' own events, each in the engine's words with the CRM named from its connection.
  'webhook.received': (fields, named) => {
    const crm = capital(theCrm(named));
    const detail = text(fields, 'detail');
    switch (text(fields, 'outcome')) {
      case 'queued':
        return `${crm} sent a notification about this record, and Core put it on the fetch list.`;
      case 'rejected':
        return `${crm} sent a notification, and Core turned it away${detail ? `: ${detail}` : ''}.`;
      case 'ignored':
        return `${crm} sent a notification, and Core left it alone${detail ? `: ${detail}` : ''}.`;
      default:
        return `${crm} sent a notification.`;
    }
  },
  'crm.call': (fields, named) => {
    const crm = theCrm(named);
    const ms = count(fields, 'duration_ms');
    const took = ms === null ? '' : ms < 1000 ? ' within a second' : ` after ${lasting(ms)}`;
    const status = count(fields, 'status');
    const error = text(fields, 'error');
    if (error) return `Core’s call to ${crm} failed${took}: ${quoted(error)}.`;
    if (status === 404) return `${capital(crm)} answered that it has no such record.`;
    if (status !== null && status >= 400) {
      return `${capital(crm)} answered Core’s call with an error, code ${String(status)}.`;
    }
    return text(fields, 'method') === 'POST'
      ? `Core sent a request to ${crm}, which answered${took}.`
      : `Core read from ${crm}, which answered${took}.`;
  },
  'fetch.failed': (fields, named) => {
    const attempts = count(fields, 'attempts');
    const detail = text(fields, 'detail');
    return `Core gave up fetching this record from ${theCrm(named)}${attempts ? ` after ${inWords(attempts, 'try', 'tries')}` : ''}.${detail ? ` The last try failed with ${quoted(detail)}.` : ''}`;
  },
  'fetch.orphan': (fields) => {
    const detail = text(fields, 'detail');
    return `Core did not fetch this record.${detail ? ` ${sentence(detail)}` : ''}`;
  },
  'office.blocked': (fields, named) => {
    const office = officeNamed(text(fields, 'office_id') ?? '?', null, named.tenant);
    const detail = text(fields, 'detail');
    return `${capital(theCrm(named))} does not let the login read ${office}, so Core stopped fetching it.${detail ? ` ${capital(theCrm(named))} answered ${quoted(detail)}.` : ''}`;
  },
  'office.unblocked': (fields, named) =>
    `${capital(theCrm(named))} lets the login read ${officeNamed(text(fields, 'office_id') ?? '?', null, named.tenant)} again, so Core fetches it again.`,
  'schedule.failed': (fields, named) => {
    const detail = text(fields, 'detail');
    return `The regular work of ${theConnection(named)} with ${theCrm(named)} failed, and Core tries again by itself.${detail ? ` What failed: ${quoted(detail)}.` : ''}`;
  },
};

/** How far a manual sync goes, by its level (`runs.ts`). */
const SYNC: Record<string, string> = {
  fetch: 'fetch it from the CRM, recompute it and send it to the sites',
  recompute: 'recompute it and send it to the sites',
  send: 'send it to the sites',
};

/** What the CRM said to a form sent again (`forms.ts`). */
const SENT_AGAIN: Record<string, string> = {
  delivered: ', and the CRM took it',
  refused: ', and the CRM refused it again',
  failed: ', and the CRM did not answer',
};

/** What a person did in the admin area: the person, then the deed, by the `admin.` event's type. */
const ADMIN: Record<string, (by: string, fields: EventFields, named: Named) => string> = {
  sign_in_requested: (by, fields) =>
    fields['allowed'] === false
      ? `${by} asked for a sign-in link, but that address may not open the admin area, so none was sent.`
      : `${by} asked for a sign-in link.`,
  signed_in: (by) => `${by} signed in.`,
  signed_out: (by) => `${by} signed out.`,
  devices_forgotten: (by, fields) => {
    const sessions = count(fields, 'sessions');
    return sessions === null
      ? `${by} signed out of every other device.`
      : `${by} signed out of ${inWords(sessions, 'other device', 'other devices')}.`;
  },
  tenant_saved: (by, _, named) =>
    `${by} saved ${named.tenant ? `${named.tenant}’s page` : 'a tenant’s page'}.`,
  tenant_removed: (by, fields) =>
    text(fields, 'name')
      ? `${by} removed the tenant ${text(fields, 'name') ?? ''}.`
      : `${by} removed a tenant.`,
  token_rotated: (by, _, named) => {
    const tenant = named.tenant ?? 'the tenant';
    return `${by} made a new token for ${tenant}. Each of ${tenant}’s sites fetches nothing until the new token is pasted into its Core settings.`;
  },
  bell_secret_rotated: (by, fields, named) => {
    const site = text(fields, 'site') ?? named.site;
    return `${by} made a new bell secret for ${site ? siteNamed(site, named.tenant) : 'a site'}. The site ignores Core’s word that something changed until the new secret is pasted into its Core settings.`;
  },
  rang: (by, fields, named) => {
    const site = text(fields, 'site') ?? named.site;
    const sites = site
      ? siteNamed(site, named.tenant)
      : `every site of ${named.tenant ?? 'the tenant'}`;
    return `${by} told ${sites} ${text(fields, 'kind') === 'forcerefresh' ? 'to fetch everything again' : 'about changes'}.`;
  },
  inspected: (by, _, named) => `${by} looked this record up in ${theCrm(named)}.`,
  recompute_queued: (by, fields) =>
    `${by} asked for a recompute of ${text(fields, 'scope') ?? 'some records'}.`,
  fetch_again: (by, fields) => {
    const queued = count(fields, 'queued');
    return `${by} asked the CRM again for ${text(fields, 'scope') ?? 'some records'}${queued === null ? '' : `, ${inWords(queued, 'record', 'records')} in all`}.`;
  },
  synced: (by, fields) =>
    `${by} started a manual sync of ${text(fields, 'scope') ?? 'some records'}, to ${SYNC[text(fields, 'level') ?? ''] ?? 'send it to the sites'}.`,
  crm_action: (by, fields) => {
    const action = (text(fields, 'action') ?? 'an action').replace(/[._-]/g, ' ');
    return `${by} ran “${action}” on the ${crmName(text(fields, 'provider') ?? 'CRM')} page.`;
  },
  login_tried: (by, fields) => {
    const provider = text(fields, 'provider');
    const crm = provider ? crmName(provider) : 'the CRM';
    const answer = fields['ok'] === true ? 'accepted' : 'refused';
    return `${by} checked ${provider ? `a ${crm}` : 'a CRM'} login, and ${crm} ${answer} it.`;
  },
  form_sent_again: (by, fields) =>
    `${by} sent ${form(fields)} to the CRM again${SENT_AGAIN[text(fields, 'outcome') ?? ''] ?? ''}.`,
  maintenance: (by, fields) => `${by} turned maintenance ${fields['on'] === true ? 'on' : 'off'}.`,
};

/** One sentence, or a few, for one event. Never a payload, never a type, never a field's name. */
export function summarise(type: string, fields: EventFields, named: Named = {}): string {
  if (type.startsWith('admin.')) {
    const deed = type.slice('admin.'.length);
    const by = text(fields, 'by') ?? text(fields, 'email') ?? 'Someone';
    const say = ADMIN[deed];
    return say
      ? say(by, fields, named)
      : `${by} did “${deed.replace(/_/g, ' ')}” in the admin area.`;
  }
  if (type.startsWith('lifecycle.'))
    return lifecycle(type.slice('lifecycle.'.length), fields, named);
  const say = SAY[type];
  if (say) return say(fields, named);
  // An adapter's own event nobody described: its type, read as words, is better than nothing.
  return sentence(type.replace(/[._]/g, ' '));
}

/** The tenants', connections' and sites' names, read once for a page of events or a round. */
export type Names = {
  tenants: Map<number, string>;
  connections: Map<string, { tenantId: number; provider: string; name: string }>;
  sites: Map<number, { tenantId: number; label: string }>;
};

export async function namesNow(): Promise<Names> {
  const [tenants, connections, sites] = await Promise.all([
    db().query<{ id: number; display_name: string }>('select id, display_name from tenants'),
    db().query<{ id: string; tenant_id: number; provider: string; name: string }>(
      'select id, tenant_id, provider, name from connections',
    ),
    db().query<{ id: string; tenant_id: number; label: string }>(
      'select id, tenant_id, label from subscribers',
    ),
  ]);
  return {
    tenants: new Map(tenants.rows.map((row) => [Number(row.id), row.display_name])),
    connections: new Map(
      connections.rows.map((row) => [
        row.id,
        { tenantId: Number(row.tenant_id), provider: row.provider, name: row.name },
      ]),
    ),
    sites: new Map(
      sites.rows.map((row) => [
        Number(row.id),
        { tenantId: Number(row.tenant_id), label: row.label },
      ]),
    ),
  };
}

type Placed = Pick<EventRow, 'tenant_id' | 'connection_id' | 'subscriber_id' | 'datatype'>;

/** The tenant an event is about: its own, its connection's or its site's. */
const tenantFor = (row: Placed, names: Names): string | null => {
  const id =
    row.tenant_id ??
    names.connections.get(row.connection_id ?? '')?.tenantId ??
    names.sites.get(Number(row.subscriber_id ?? Number.NaN))?.tenantId;
  return names.tenants.get(Number(id)) ?? null;
};

/** The names one event's sentence uses, from its row: its tenant, site, connection, CRM and type. */
export function namedFor(row: Placed, names: Names): Named {
  const connection = names.connections.get(row.connection_id ?? '');
  const tenant = tenantFor(row, names);
  return {
    tenant,
    site: names.sites.get(Number(row.subscriber_id ?? Number.NaN))?.label ?? null,
    connection: row.connection_id
      ? connectionNamed(connection?.name ?? row.connection_id, tenant, connection?.provider)
      : null,
    crm: connection ? crmName(connection.provider) : null,
    datatype: row.datatype,
  };
}

/** Each event's sentence, with the names read once: what a timeline or a list shows. */
export async function sentences(
  rows: (Placed & Pick<EventRow, 'type' | 'fields'>)[],
): Promise<string[]> {
  if (rows.length === 0) return [];
  const names = await namesNow();
  return rows.map((row) => summarise(row.type, row.fields, namedFor(row, names)));
}
