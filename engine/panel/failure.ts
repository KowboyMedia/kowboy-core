// What a signed-in person reads when Core failed at what the panel asked: what failed, in the
// failing part's own words, whose fault it is and what to do (Patric, 2026-10-18: should he report
// it to Core's developers or to the CRM, is the login wrong, "or storage out or what"). An error's
// words can name Core's insides, so the panel's API gives them to a signed-in person only; the
// error tracker keeps the whole error for Core's developers.

/**
 * Postgres's classes of error for a database that is out of reach, full or shutting down, that
 * refused Core's own login to it or has no such database, or whose disk failed.
 */
const DATABASE_DOWN = /^(08|28|3D|53|57P|58)/;

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

/** The codes for a database whose certificate Core does not trust. */
const UNTRUSTED = /CERT|UNABLE_TO_VERIFY/;

/**
 * The database client's words for a connection it lost or closed, a connection that did not come
 * free in time, and a query the database did not answer in time.
 */
const CONNECTION_LOST =
  /^(Connection terminated|timeout exceeded when trying to connect|Query read timeout|Client has encountered a connection error|Client was closed)/;

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
export function databaseFailed(error: unknown): boolean {
  const code = codeOf(error);
  if (DATABASE_DOWN.test(code) || UNREACHED.has(code) || UNTRUSTED.test(code)) return true;
  return error instanceof Error && CONNECTION_LOST.test(error.message);
}

/**
 * What was asked of Core: `crm` when it was the part of Core that talks to that CRM, and `reading`
 * when the panel was reading a page, which tries again by itself, rather than a person's press.
 */
type Asked = { crm?: string; reading?: boolean };

/** Whose the database is, and what to do. */
function databaseTail({ crm, reading = false }: Asked): string {
  const not = crm ? `${crm} or its login` : 'a CRM or a CRM login';
  return reading
    ? `This is Core’s own database, not ${not}. If this lasts more than a few minutes, pass these words on to Core’s developers.`
    : `This is Core’s own database, not ${not}. Try again in a few minutes; if it still fails, pass these words on to Core’s developers.`;
}

/**
 * Core's database failed it, in words without the error's own, for a request Core has not yet
 * known to be a signed-in person's.
 */
export const databaseWords = (asked: Asked = {}): string =>
  `Core couldn’t use its database just now. ${databaseTail(asked)}`;

/**
 * What failed in Core, whose fault it is and what to do, as sentences for the panel to show. With
 * `crm`, it was the part of Core that talks to that CRM, and the failure is Core's, never the
 * CRM's or its login's: the actions the panel runs there only read and write Core's own database,
 * for the CRM's code to act on later, and the login test words the CRM's own answers itself.
 */
export function failureWords(error: unknown, asked: Asked = {}): string {
  const said = ownWords(error);
  if (databaseFailed(error)) {
    return `Core couldn’t use its database, and the database’s error said “${said}”. ${databaseTail(asked)}`;
  }
  const { crm } = asked;
  if (crm) {
    return `The part of Core that talks to ${crm} failed, and its error said “${said}”. This is a fault in Core, not at ${crm} or in the login, so pass these words on to Core’s developers.`;
  }
  return `Core failed with an error in its own code, which said “${said}”. This is a fault in Core, not in a CRM or a login, so pass these words on to Core’s developers.`;
}
