// What a signed-in person reads when Core failed at what the panel asked: what failed, in the
// failing part's own words, whose fault it is and what to do (Patric, 2026-10-18: should he report
// it to Core's developers or to the CRM, is the login wrong, "or storage out or what"). An error's
// words can name Core's insides, so the panel's API gives them to a signed-in person only; the
// error tracker keeps the whole error for Core's developers.

/** Postgres's classes of error for a database that is out of reach, full or shutting down. */
const DATABASE_DOWN = /^(08|53|57P)/;

/** The network's codes for a database Core cannot reach. */
const UNREACHED = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
]);

/** The database client's words for a connection it lost, or one that did not come free in time. */
const CONNECTION_LOST = /^(Connection terminated|timeout exceeded when trying to connect)/;

const codeOf = (error: unknown): string => {
  const code = error instanceof Error ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : '';
};

/** An error's own words, quoted in a sentence: one line, short, without a full stop of its own. */
function ownWords(error: unknown): string {
  const said =
    error instanceof Error ? error.message || codeOf(error) || error.name : String(error);
  return said
    .replace(/\s+/g, ' ')
    .slice(0, 300)
    .replace(/[\s.]+$/, '')
    .trim();
}

/** Core's database failed it, rather than Core's own code. */
function databaseFailed(error: unknown): boolean {
  const code = codeOf(error);
  if (DATABASE_DOWN.test(code) || UNREACHED.has(code)) return true;
  return error instanceof Error && CONNECTION_LOST.test(error.message);
}

/**
 * What failed in Core, whose fault it is and what to do, as sentences for the panel to show. With
 * `crm`, it was the part of Core that talks to that CRM: what the panel runs there today only
 * writes to Core's own database, so a failure is Core's, never the CRM's or its login's.
 */
export function failureWords(error: unknown, crm?: string): string {
  const said = ownWords(error);
  if (databaseFailed(error)) {
    return `Core couldn’t use its database, and the database’s error said “${said}”. This is Core’s database, not ${crm ?? 'a CRM'} or a login: Core carries on by itself once the database answers, so if this lasts more than a few minutes, pass these words on to Core’s developers.`;
  }
  if (crm) {
    return `The part of Core that talks to ${crm} failed, and its error said “${said}”. This is a fault in Core, not at ${crm} or in the login, so pass these words on to Core’s developers.`;
  }
  return `Core failed with an error in its own code, which said “${said}”. This is a fault in Core, not in a CRM or a login, so pass these words on to Core’s developers.`;
}
