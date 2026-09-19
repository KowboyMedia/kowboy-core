import { RULES_VERSION } from './version.js';
import { officeStrings, projectStrings, propertyStrings } from './strings.js';
import { PROPERTY_SECTIONS, renderSections } from './sections.js';
import type { Canonical, Datatype } from '../adapter-api/types.js';

/**
 * `display` (SRS §7, strategy §12.23): the prepared strings the engine computes from the
 * universal record, one interpreter for every CRM, each string by its entry in `rules-ledger/`.
 * Formatting only: the engine never decides anything from a value. Pure by contract: same input,
 * same output, no I/O and no clock, which is what makes recompute safe.
 */
export function applyRules(datatype: Datatype, input: Canonical): Canonical {
  const display = strings(datatype, input);
  if (datatype === 'property') {
    const sections = renderSections({ ...input, display }, PROPERTY_SECTIONS);
    return { ...input, display: { ...display, sections } };
  }
  return { ...input, display };
}

function strings(datatype: Datatype, input: Canonical): Record<string, string> {
  switch (datatype) {
    case 'property':
      return propertyStrings(input);
    case 'project':
      return projectStrings(input);
    case 'office':
      return officeStrings(input);
    default:
      return {};
  }
}

export { RULES_VERSION };
