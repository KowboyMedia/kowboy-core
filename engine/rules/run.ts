import { RULES_VERSION } from './version.js';
import type { Canonical, Datatype } from '../adapter-api/types.js';

/**
 * Business rules and `display` (SRS §7).
 *
 * **There are no rules yet, on purpose.** Every rule comes from `rules-ledger/`, which Kowboy
 * writes, and the CRM data models have not been read, so there is nothing to compute a rule over.
 * Formatting invented here would be a guess wearing the clothes of a decision.
 *
 * What this step guarantees today: `display` exists on every record, and the pipeline has one
 * place for rules to live. Pure by contract: same input, same output, no I/O and no clock, which
 * is what makes recompute safe.
 */
export function applyRules(_datatype: Datatype, input: Canonical): Canonical {
  const display = input['display'];
  return {
    ...input,
    display: display && typeof display === 'object' && !Array.isArray(display) ? display : {},
  };
}

export { RULES_VERSION };
