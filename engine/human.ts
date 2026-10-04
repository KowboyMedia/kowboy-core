// The bot gate (docs/forms.md, question 138: Turnstile) behind one interface, so another service
// can be chosen per site the day a brokerage insists. The browser gets the service's public site
// key from the forms config and sends the token it earned with the submission; Core verifies it
// here with the secret only Core holds. With no service configured there is no gate, which is
// the local and test setup; production sets TURNSTILE_SITE_KEY and TURNSTILE_SECRET.

export type HumanCheck = {
  provider: 'turnstile';
  /** The service's public key, which the browser renders the challenge with. */
  siteKey: string;
  /** True when the token stands for a person; the address is the visitor's, when known. */
  verify: (token: string, address: string | null) => Promise<boolean>;
};

let check: HumanCheck | null = null;

export function configureHumanCheck(given: HumanCheck | null): void {
  check = given;
}

/** What the forms config tells the browser: which service to render, with which key; null for none. */
export const humanCheck = (): { provider: string; site_key: string } | null =>
  check ? { provider: check.provider, site_key: check.siteKey } : null;

/** True when there is no gate, or the token passes it. A missing token never passes a gate. */
export async function verifyHuman(token: string | null, address: string | null): Promise<boolean> {
  if (!check) return true;
  if (!token) return false;
  try {
    return await check.verify(token, address);
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
    async verify(token, address) {
      const body = new URLSearchParams({ secret, response: token });
      if (address) body.set('remoteip', address);
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
