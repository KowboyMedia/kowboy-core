// Enforced check: nothing in the contract or the rules is invented.
//
// Why this exists: an agent once filled the schemas with fields that looked plausible for a
// Swedish brokerage - phone, email, price - without having read a single CRM data model. Plausible
// is not known. This check makes "where did this come from?" a question the repository answers
// mechanically rather than a question a reviewer has to think to ask.
//
//  1. Every field in `schemas/` names the human-written source it came from.
//  2. That source is one of the documents Kowboy supplies, and it exists.
//  3. Every business rule in `engine/rules/` names the rules-ledger entry that defines it.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { walk } from './lib/walk.mjs';
import { report } from './lib/report.mjs';

// The only places a contract field may come from. A CRM data model counts once it is in the repo
// as a human-supplied document, never as something an agent remembered or assumed.
const SOURCE_PREFIXES = ['SRS §', 'Concept', 'strategy §', 'rules-ledger/', 'docs/inputs/', 'crm:'];
// Words that mean "someone guessed". A source is a citation, not a justification.
const NOT_A_SOURCE =
  /\b(assum|guess|probabl|likely|typical|obvious|common|usual|illustrat|example of|standard for)/i;

const violations = [];

const schemaFiles = existsSync('schemas')
  ? readdirSync('schemas').filter((name) => name.endsWith('.json'))
  : [];

for (const file of schemaFiles) {
  if (file === '_shared.v1.json') continue;
  const schema = JSON.parse(readFileSync(join('schemas', file), 'utf8'));
  for (const [field, definition] of Object.entries(schema.properties ?? {})) {
    const source = definition.source;
    if (typeof source !== 'string' || source.trim() === '') {
      violations.push(
        `schemas/${file}: field "${field}" has no "source"; a field nobody wrote down is a question, not a default`,
      );
      continue;
    }
    if (!SOURCE_PREFIXES.some((prefix) => source.startsWith(prefix))) {
      violations.push(
        `schemas/${file}: field "${field}" cites "${source}", which is not one of: ${SOURCE_PREFIXES.join(', ')}`,
      );
    }
    if (NOT_A_SOURCE.test(source)) {
      violations.push(
        `schemas/${file}: field "${field}" cites "${source}", which reads as a guess rather than a citation`,
      );
    }
    for (const prefix of ['rules-ledger/', 'docs/inputs/']) {
      if (source.startsWith(prefix) && !existsSync(source.split(/\s/)[0])) {
        violations.push(
          `schemas/${file}: field "${field}" cites "${source}", which does not exist`,
        );
      }
    }
  }
}

// Business rules: one function per ledger entry, each naming the entry it implements (SRS §7).
const RULES_PLUMBING = new Set(['engine/rules/run.ts', 'engine/rules/version.ts']);
for (const file of walk('engine/rules', ['.ts'])) {
  if (RULES_PLUMBING.has(file) || file.endsWith('.test.ts')) continue;
  const entry = /@ledger\s+(\S+)/.exec(readFileSync(file, 'utf8'))?.[1];
  if (!entry) {
    violations.push(
      `${file}: a business rule must name the ledger entry it implements, as "@ledger <entry>"`,
    );
  } else if (
    !existsSync(join('rules-ledger', entry)) &&
    !existsSync(join('rules-ledger', `${entry}.md`))
  ) {
    violations.push(
      `${file}: cites ledger entry "${entry}", which does not exist in rules-ledger/`,
    );
  }
}

report('nothing invented', violations);
