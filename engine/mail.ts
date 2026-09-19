// Mail the engine sends: today only the admin panel's login links. One sender, configured at
// start from the environment; the tests replace it with one that keeps the mail. The sender is
// Postmark's HTTP API (question 31): the platform blocks SMTP ports, so no mail server can be
// spoken to directly, and Kowboy's own domain is locked to a stranger's Elastic Email account.
export type Mail = { to: string; subject: string; text: string };
export type Sender = (mail: Mail) => Promise<void>;

let sender: Sender | null = null;

export function configureMail(next: Sender | null): void {
  sender = next;
}

export const mailConfigured = (): boolean => sender !== null;

/** Send one mail, or throw when no sender is configured. */
export async function sendMail(mail: Mail): Promise<void> {
  if (!sender) throw new Error('no mail sender is configured: POSTMARK_SERVER_TOKEN and MAIL_FROM');
  await sender(mail);
}

/** Postmark's single-email endpoint, plain text only. */
export const postmark =
  (serverToken: string, from: string): Sender =>
  async (mail) => {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-postmark-server-token': serverToken,
      },
      body: JSON.stringify({
        From: from,
        To: mail.to,
        Subject: mail.subject,
        TextBody: mail.text,
        MessageStream: 'outbound',
      }),
    });
    if (!response.ok) {
      throw new Error(`mail not sent: ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
  };
