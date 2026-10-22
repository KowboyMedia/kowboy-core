// The bot check (docs/forms.md, question 138: Turnstile) behind one interface, so another service
// can be chosen the day a brokerage insists. A site's server reads the service's public key from
// Core (`GET /v1/submissions/bot-check`), its form window renders the challenge with it, and the
// site's server passes the proof the window earned on with the form; Core verifies it here with
// the secret only Core holds. The check never fails silently (the forms list, 2026-10-07): a
// visitor whose own proof fails is refused and asked to try again, and a check that cannot run,
// on Core's side or in the visitor's browser, is broken, with its cause, so the form stops with a
// clear message and an alert (engine/http/submissions.ts). Production sets TURNSTILE_SITE_KEY and
// TURNSTILE_SECRET; elsewhere, without them, Core uses Cloudflare's published test keys, whose
// check always passes, so staging's forms run the whole path until real keys are set.

export type HumanCheck = {
  provider: 'turnstile';
  /** The service's public key, which the form window renders the challenge with. */
  siteKey: string;
  /** The secret Core verifies with, so the list's setup can be told to hold the same one. */
  secret: string;
  /** What the service makes of a proof. */
  verify: (token: string) => Promise<Verdict>;
};

/**
 * What the check made of a form's proof: it passed; it was the visitor's and failed, so they try
 * again; or the check itself could not run, with the cause in a sentence for the alert.
 */
export type Verdict = { kind: 'passed' } | { kind: 'refused' } | { kind: 'broken'; cause: string };

const PASSED: Verdict = { kind: 'passed' };
const REFUSED: Verdict = { kind: 'refused' };
const broken = (cause: string): Verdict => ({ kind: 'broken', cause });

/** Cloudflare's published test keys: any address, and every proof passes (Turnstile's testing page). */
export const TEST_SITE_KEY = '1x00000000000000000000AA';
export const TEST_SECRET = '1x0000000000000000000000000000000AA';

let check: HumanCheck | null = null;

export function configureHumanCheck(given: HumanCheck | null): void {
  check = given;
}

/** What a site's server is told: which service to render, with which key; null for none. */
export const humanCheck = (): { provider: string; site_key: string } | null =>
  check ? { provider: check.provider, site_key: check.siteKey } : null;

/**
 * What the form window sends in place of a proof when the check could not run in the browser:
 * `unavailable:` and why, Cloudflare's error code or one of the window's own words below.
 */
const UNAVAILABLE = 'unavailable:';

/**
 * Cloudflare's client error codes that are the visitor's own challenge failing or timing out,
 * or a browser it does not support (Turnstile's client-side errors page): the visitor tries again.
 * Every other code is a problem with the check itself.
 */
const VISITORS_OWN = /^(?:300\d{3}|600\d{3}|110500|110510|110600|110620)$/;

/** What the window's own words and Cloudflare's setup codes mean, for the alert. */
const IN_THE_BROWSER: Record<string, string> = {
  'no-key': 'the website had no public key for the bot check to show',
  script: 'Cloudflare’s bot check did not load in the visitor’s browser',
  '110100': 'Cloudflare does not know the bot check’s public key',
  '110110': 'Cloudflare does not know the bot check’s public key',
  '400020': 'Cloudflare does not know the bot check’s public key',
  '400021': 'Cloudflare does not know the bot check’s public key',
  '400070': 'the bot check is switched off at Cloudflare',
  '110200': 'the website’s address is not on the bot check’s list at Cloudflare',
  '200500': 'Cloudflare’s bot check could not load in the visitor’s browser',
};

/** What the browser's report means: the visitor's own challenge failing, or the check broken. */
function fromTheBrowser(why: string): Verdict {
  const code = /^[a-z0-9-]{1,40}$/i.test(why) ? why : 'unknown';
  if (VISITORS_OWN.test(code)) return REFUSED;
  return broken(
    IN_THE_BROWSER[code] ??
      `the bot check failed in the visitor’s browser (Cloudflare’s code ${code})`,
  );
}

/**
 * The proof's verdict. No proof at all is refused: a program posting straight to Core, not the
 * window, which always sends a proof or the reason it has none.
 */
export async function verifyHuman(proof: string | null): Promise<Verdict> {
  if (!check) return broken('Core has no keys for the bot check');
  if (!proof) return REFUSED;
  if (proof.startsWith(UNAVAILABLE)) return fromTheBrowser(proof.slice(UNAVAILABLE.length));
  try {
    return await check.verify(proof);
  } catch (error) {
    return broken(
      `the bot check failed in Core: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** The siteverify error codes that are Core's setup, not the visitor (Turnstile's server-side page). */
const SECRET_REFUSED = new Set(['missing-input-secret', 'invalid-input-secret']);

/** Cloudflare Turnstile: the token is verified server-side with Kowboy's secret. */
export function turnstile(siteKey: string, secret: string): HumanCheck {
  return {
    provider: 'turnstile',
    siteKey,
    secret,
    async verify(token) {
      const body = new URLSearchParams({ secret, response: token });
      let response: globalThis.Response;
      try {
        response = await fetch(TURNSTILE_VERIFY, {
          method: 'POST',
          body,
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        return broken('Cloudflare’s bot check did not answer Core');
      }
      if (!response.ok) {
        return broken(`Cloudflare’s bot check answered Core with ${String(response.status)}`);
      }
      const answer = (await response.json().catch(() => null)) as {
        success?: boolean;
        'error-codes'?: string[];
      } | null;
      if (!answer) return broken('Cloudflare’s bot check gave Core an answer it could not read');
      if (answer.success === true) return PASSED;
      const codes = answer['error-codes'] ?? [];
      if (codes.some((code) => SECRET_REFUSED.has(code))) {
        return broken('Cloudflare refused Core’s secret key for the bot check');
      }
      if (codes.includes('internal-error')) return broken('Cloudflare’s bot check had an error');
      if (codes.includes('bad-request')) return broken('Cloudflare could not read Core’s question');
      // invalid-input-response, timeout-or-duplicate, missing-input-response: the visitor's proof.
      return REFUSED;
    },
  };
}

/** Kowboy's Cloudflare account and its key that may change Turnstile (question 171 a), or null. */
let cloudflare: { accountId: string; token: string } | null = null;

export function configureBotCheckList(given: { accountId: string; token: string } | null): void {
  cloudflare = given;
}

/** The addresses one bot check setup lists on Cloudflare's free plan (Turnstile's plans page, 2026-08-14). */
export const LIST_LIMIT = 10;

/**
 * Whether a website's address is on the bot check's list. `full` when the list holds as many as
 * the free plan allows, so the website is refused: paying is asked before an eleventh (146).
 */
export type Listed = { listed: true } | { listed: false; full: boolean; why: string };

const notListed = (why: string, full = false): Listed => ({ listed: false, full, why });

type Widget = {
  name: string;
  domains: string[];
  mode: string;
  clearance_level?: string;
  secret: string;
};

/** One call to Cloudflare's Turnstile setup; null when it did not answer or said no. */
async function widgetCall(
  method: 'GET' | 'PUT',
  body?: Record<string, unknown>,
): Promise<Widget | null> {
  if (!cloudflare || !check) return null;
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cloudflare.accountId)}/challenges/widgets/${encodeURIComponent(check.siteKey)}`,
      {
        method,
        headers: {
          authorization: `Bearer ${cloudflare.token}`,
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const answer = (await response.json().catch(() => null)) as {
      success?: boolean;
      result?: Widget;
    } | null;
    return response.ok && answer?.success === true && answer.result ? answer.result : null;
  } catch {
    return null;
  }
}

/**
 * Put a website's address on the bot check's list at Cloudflare (question 171 a), which Core's
 * admin does when it saves the website, so the challenge runs on its pages. Cloudflare's test
 * keys take any address, so outside production there is nothing to list. The answer says, in a
 * sentence for the person saving, why an address is not on it: the list is full, Core has no
 * Cloudflare key, Cloudflare did not answer, or Cloudflare holds another secret for the public key
 * than Core does, which would refuse every visitor.
 */
export async function listOnBotCheck(address: string): Promise<Listed> {
  let host: string;
  try {
    host = new URL(address).hostname.toLowerCase();
  } catch {
    return notListed(
      'The website’s address is not a web address, so it could not be put on the bot check’s list.',
    );
  }
  if (!check) {
    return notListed(
      'Core has no keys for the bot check, so the website’s forms are stopped until it has.',
    );
  }
  if (check.siteKey === TEST_SITE_KEY) return { listed: true };
  if (!cloudflare) {
    return notListed(
      'Core has no Cloudflare key, so the website’s address could not be put on the bot check’s list, and its forms are stopped until it is.',
    );
  }
  const widget = await widgetCall('GET');
  if (!widget) {
    return notListed(
      'Cloudflare did not answer, so the website’s address could not be put on the bot check’s list; save the website again in a while.',
    );
  }
  if (widget.secret !== check.secret) {
    return notListed(
      'Cloudflare holds another secret for the bot check than Core does, so it would refuse every visitor’s form; the two keys in Core’s settings must be one pair from Cloudflare.',
    );
  }
  if (widget.domains.map((domain) => domain.toLowerCase()).includes(host)) return { listed: true };
  if (widget.domains.length >= LIST_LIMIT) {
    return notListed(
      `The bot check’s list at Cloudflare holds ${String(LIST_LIMIT)} websites, the most its free plan allows, so this website is not saved. An eleventh website needs Cloudflare’s paid plan first.`,
      true,
    );
  }
  const saved = await widgetCall('PUT', {
    name: widget.name,
    mode: widget.mode,
    domains: [...widget.domains, host],
    ...(widget.clearance_level ? { clearance_level: widget.clearance_level } : {}),
  });
  return saved?.domains.map((domain) => domain.toLowerCase()).includes(host)
    ? { listed: true }
    : notListed(
        'Cloudflare did not take the website’s address on the bot check’s list; save the website again in a while.',
      );
}
