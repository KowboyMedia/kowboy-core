// The bot check (docs/forms.md, question 138: Turnstile) behind one interface, so another service
// can be chosen the day a brokerage insists. A site's server reads the service's public key from
// Core (`GET /v1/submissions/bot-check`), its form window renders the challenge with it, and the
// site's server passes the proof the window earned on with the form; Core verifies it here with
// the secret only Core holds. With no service configured there is no check: staging and local
// take forms without one, since they send none on, and the live service refuses every form
// (engine/http/submissions.ts). Production sets TURNSTILE_SITE_KEY and TURNSTILE_SECRET.

export type HumanCheck = {
  provider: 'turnstile';
  /** The service's public key, which the form window renders the challenge with. */
  siteKey: string;
  /** True when the token stands for a person. */
  verify: (token: string) => Promise<boolean>;
};

let check: HumanCheck | null = null;

export function configureHumanCheck(given: HumanCheck | null): void {
  check = given;
}

/** What a site's server is told: which service to render, with which key; null for none. */
export const humanCheck = (): { provider: string; site_key: string } | null =>
  check ? { provider: check.provider, site_key: check.siteKey } : null;

/** True when there is no gate, or the token passes it. A missing token never passes a gate. */
export async function verifyHuman(token: string | null): Promise<boolean> {
  if (!check) return true;
  if (!token) return false;
  try {
    return await check.verify(token);
  } catch {
    return false;
  }
}

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare Turnstile: the token is verified server-side with Kowboy's secret. */
export function turnstile(siteKey: string, secret: string): HumanCheck {
  return {
    provider: 'turnstile',
    siteKey,
    async verify(token) {
      const body = new URLSearchParams({ secret, response: token });
      const response = await fetch(TURNSTILE_VERIFY, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) return false;
      const answer = (await response.json()) as { success?: boolean };
      return answer.success === true;
    },
  };
}
