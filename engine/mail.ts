// Mail the engine sends: today only the admin panel's login links. One sender, configured at
// start from the environment; the tests replace it with one that keeps the mail. The sender is
// Elastic Email's HTTP API, which Kowboy's domain already lists as a sender (its SPF record), so
// no new vendor and no DNS change; SMTP is not an option, as the platform blocks its ports.
export type Mail = { to: string; subject: string; text: string };
export type Sender = (mail: Mail) => Promise<void>;

let sender: Sender | null = null;

export function configureMail(next: Sender | null): void {
  sender = next;
}

export const mailConfigured = (): boolean => sender !== null;

/** Send one mail, or throw when no sender is configured. */
export async function sendMail(mail: Mail): Promise<void> {
  if (!sender) throw new Error('no mail sender is configured: ELASTIC_EMAIL_API_KEY and MAIL_FROM');
  await sender(mail);
}

/** Elastic Email's transactional endpoint, plain text only. */
export const elasticEmail =
  (apiKey: string, from: string): Sender =>
  async (mail) => {
    const response = await fetch('https://api.elasticemail.com/v4/emails/transactional', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-elasticemail-apikey': apiKey },
      body: JSON.stringify({
        Recipients: { To: [mail.to] },
        Content: {
          From: from,
          Subject: mail.subject,
          Body: [{ ContentType: 'PlainText', Content: mail.text, Charset: 'utf-8' }],
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`mail not sent: ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
  };
