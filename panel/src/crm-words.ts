// B's words for a CRM's own ideas: its login's fields, live system or test system, and its office
// check. Core's engine names no CRM (the seam); it hands on the keys the CRM's code declares, and
// this file words them as design B does, by provider and key. A CRM with no entry here is worded
// from its name and the labels its code declares.
import type { Crm, CrmField } from './api';

export type CrmWords = {
  /** The field that picks the CRM's live system or its test system, and the words for each. */
  system?: {
    key: string;
    label: string;
    /** Its value for the test system; any other value is the live one. */
    test: string;
    /** Each value's words on a choice, and its short words in a sentence ("forms sent to …"). */
    options: Record<string, { label: string; short: string }>;
  };
  /** The other fields' words, by key. */
  fields: Record<string, { label: string; help?: string }>;
  /** The field shown after the system on a connection's line ("Live Vitec · G31"). */
  shownField?: string;
  /** That field in a sentence, from its value: "customer id M14582". */
  shownAs?: (value: string) => string;
  /** Two fields shown side by side after the others, with one line under both. */
  pair?: { keys: [string, string]; help?: string };
  /** The action of the CRM's code that checks the connection's offices now. */
  officeCheck?: string;
};

const WORDS: Record<string, CrmWords> = {
  vitec: {
    system: {
      key: 'qa',
      label: 'Vitec system',
      test: 'yes',
      options: {
        no: { label: 'Live Vitec', short: 'Vitec' },
        yes: { label: 'Vitec QA (test system)', short: 'Vitec QA' },
      },
    },
    fields: {
      customer_id: {
        label: 'Customer or group id',
        help: 'From Vitec: an office’s customer id (M…) or the id of a group of offices (G…).',
      },
      username: { label: 'Username' },
      password: { label: 'Password' },
    },
    shownField: 'customer_id',
    shownAs: (value) => `${/^g/i.test(value) ? 'group id' : 'customer id'} ${value}`,
    pair: { keys: ['username', 'password'], help: 'From the Vitec Connect key pair' },
    officeCheck: 'check_offices',
  },
};

export const wordsFor = (provider: string): CrmWords => WORDS[provider] ?? { fields: {} };

/** A field's words: B's where this file has them, else the CRM code's own label. */
export function fieldWords(crm: Crm, field: CrmField): { label: string; help: string | null } {
  const words = wordsFor(crm.provider).fields[field.key];
  return { label: words?.label ?? field.label, help: words?.help ?? field.help };
}

/** Whether a saved login is for the CRM's test system. */
export function isTestSystem(provider: string, login: Record<string, string>): boolean {
  const system = wordsFor(provider).system;
  return system ? login[system.key] === system.test : false;
}

/** The system's words for a saved login: "Live Vitec", "Vitec QA (test system)". */
export function systemLabel(crm: string, provider: string, login: Record<string, string>): string {
  const system = wordsFor(provider).system;
  if (!system) return crm;
  const value = login[system.key] ?? Object.keys(system.options)[0] ?? '';
  return system.options[value]?.label ?? crm;
}

/** The system's short words for a saved login, in a sentence: "Vitec", "Vitec QA". */
export function systemShort(crm: string, provider: string, login: Record<string, string>): string {
  const system = wordsFor(provider).system;
  if (!system) return crm;
  const value = login[system.key] ?? Object.keys(system.options)[0] ?? '';
  return system.options[value]?.short ?? crm;
}

/** A connection's login in one line: "Live Vitec · G31". */
export function loginLine(crm: string, provider: string, login: Record<string, string>): string {
  const shown = wordsFor(provider).shownField;
  const value = shown ? login[shown] : undefined;
  return [systemLabel(crm, provider, login), value].filter(Boolean).join(' · ');
}

/** The login a CRM refused, in a sentence: "customer id M14582", or null when it shows none. */
export function loginNamed(provider: string, login: Record<string, string>): string | null {
  const words = wordsFor(provider);
  const value = words.shownField ? login[words.shownField] : undefined;
  if (!value) return null;
  return words.shownAs ? words.shownAs(value) : value;
}
