// Mail the engine sends: the alerts and the admin panel's sign-in links. One sender, configured at
// start from the environment; the tests replace it with one that keeps the mail. The sender is
// Amazon SES's HTTP API (Patric, 2026-10-24: Kowboy's sending keys for mail.kowboy.se): the
// platform blocks SMTP ports, so no mail server can be spoken to directly.
import { createHash, createHmac } from 'node:crypto';

export type Mail = {
  to: string;
  subject: string;
  text: string;
  /** An HTML copy, for a mail that needs a button (the panel's sign-in link); the text goes too. */
  html?: string;
};
export type Sender = (mail: Mail) => Promise<void>;

let sender: Sender | null = null;

export function configureMail(next: Sender | null): void {
  sender = next;
}

export const mailConfigured = (): boolean => sender !== null;

/** Send one mail, or throw when no sender is configured. */
export async function sendMail(mail: Mail): Promise<void> {
  if (!sender) throw new Error('no mail sender is configured: the AWS_SES_ settings');
  await sender(mail);
}

export type SesKeys = { accessKeyId: string; secretAccessKey: string; region: string };

/** SES's single-email endpoint (API v2): the text, and the HTML copy when the mail has one. */
export const ses =
  (keys: SesKeys, from: string): Sender =>
  async (mail) => {
    const body = JSON.stringify({
      FromEmailAddress: from,
      Destination: { ToAddresses: [mail.to] },
      Content: {
        Simple: {
          Subject: { Data: mail.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: mail.text, Charset: 'UTF-8' },
            ...(mail.html ? { Html: { Data: mail.html, Charset: 'UTF-8' } } : {}),
          },
        },
      },
    });
    const host = `email.${keys.region}.amazonaws.com`;
    const path = '/v2/email/outbound-emails';
    const response = await fetch(`https://${host}${path}`, {
      method: 'POST',
      headers: signed(keys, host, path, body, new Date()),
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`mail not sent: ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
  };

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const hmac = (key: string | Buffer, text: string): Buffer =>
  createHmac('sha256', key).update(text).digest();

/** The headers of a POST signed with AWS's Signature Version 4 for SES. */
export function signed(
  keys: SesKeys,
  host: string,
  path: string,
  body: string,
  now: Date,
): Record<string, string> {
  const stamp = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = stamp.slice(0, 8);
  const contentType = 'application/json';
  const names = 'content-type;host;x-amz-date';
  const canonical = [
    'POST',
    path,
    '',
    `content-type:${contentType}\nhost:${host}\nx-amz-date:${stamp}\n`,
    names,
    sha256(body),
  ].join('\n');
  const scope = `${day}/${keys.region}/ses/aws4_request`;
  const key = hmac(
    hmac(hmac(hmac(`AWS4${keys.secretAccessKey}`, day), keys.region), 'ses'),
    'aws4_request',
  );
  const signature = createHmac('sha256', key)
    .update(['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n'))
    .digest('hex');
  return {
    'content-type': contentType,
    'x-amz-date': stamp,
    authorization: `AWS4-HMAC-SHA256 Credential=${keys.accessKeyId}/${scope}, SignedHeaders=${names}, Signature=${signature}`,
  };
}
