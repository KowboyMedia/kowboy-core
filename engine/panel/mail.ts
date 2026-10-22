// The sign-in email (design B, image 03): a Sign in button, the clock time the link stops working,
// and the panel's own address, as HTML with a plain-text copy for mail programs that show only text.
import type { Mail } from '../mail.js';

/** Core's clocks are Stockholm's, as in the alerts. */
const ZONE = 'Europe/Stockholm';

/** "09:25", in Stockholm time. */
export const clockOf = (at: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);

/** The instance as a person reads it: "Production", "Staging", "Local". */
export const instanceName = (environment: string): string =>
  environment.charAt(0).toUpperCase() + environment.slice(1);

/** The panel's address without its scheme, as the mail shows it: "core.kowboy.se/admin". */
export const shownAddress = (base: string): string =>
  `${base.replace(/^https?:\/\//, '').replace(/\/$/, '')}/admin`;

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type SignInMail = {
  to: string;
  /** The whole address the button opens: the panel's link page with the token after the #. */
  link: string;
  /** Core's own address, where the panel is: PUBLIC_URL, or the local one in a local run. */
  base: string;
  expiresAt: Date;
  environment: string;
};

export function signInMail(input: SignInMail): Mail {
  const instance = instanceName(input.environment);
  const until = clockOf(input.expiresAt);
  const address = shownAddress(input.base);
  const note = `The link works once, until ${until}, and signs in the device you open it on. Didn’t ask for it? Ignore this email.`;
  const text = [
    `Sign in to Kowboy Core (${instance}).`,
    `Sign in: ${input.link}`,
    note,
    `Kowboy Core’s admin panel: ${address}`,
  ].join('\n\n');
  const font = "font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Your sign-in link for Kowboy Core</title></head>
<body style="margin:0;padding:24px 12px;background:#fafafa;${font};color:#373a3e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e3e5e8;border-radius:8px">
<tr><td style="padding:32px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:28px;height:28px;background:#066fd1;border-radius:6px;color:#ffffff;font-weight:700;font-size:16px;text-align:center;vertical-align:middle">K</td>
<td style="padding-left:9px;font-size:17px;color:#373a3e">Kowboy <strong>Core</strong></td>
</tr></table>
<p style="margin:24px 0 0;font-size:16px">Sign in to Kowboy Core <span style="color:#6b7280">(${escape(instance)})</span>.</p>
<p style="margin:20px 0 0"><a href="${escape(input.link)}" style="display:inline-block;background:#066fd1;color:#ffffff;text-decoration:none;font-size:16px;padding:13px 25px;border-radius:6px">Sign in</a></p>
<p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#6b7280">${escape(note)}</p>
<p style="margin:4px 0 0;font-size:14px;color:#6b7280">Kowboy Core’s admin panel: <strong>${escape(address)}</strong></p>
</td></tr></table>
</body></html>`;
  return { to: input.to, subject: 'Your sign-in link for Kowboy Core', text, html };
}
