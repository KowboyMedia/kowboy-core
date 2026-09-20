// What every journey does: log in through the mailed link, as a person would.
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const OPERATOR = 'operator@example.test';
export const USERNAME = 'partner';
export const PASSWORD = 'connect-key';
export const OFFICE = 'M1';

type Mail = { to: string; subject: string; text: string };

/** Ask for a link on the login page, read the mail Core "sent", open the link. */
export async function login(page: Page, email = OPERATOR): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Your email address').fill(email);
  await page.getByRole('button', { name: 'Send me a link' }).click();
  await expect(page.getByRole('status')).toContainText('a link is on its way');
  const answer = await page.request.get('/__e2e/mails');
  const { mails } = (await answer.json()) as { mails: Mail[] };
  const link = mails
    .filter((mail) => mail.to === email)
    .at(-1)
    ?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no login link was mailed to ${email}`);
  await page.goto(link);
  await expect(page.getByTestId('environment')).toBeVisible();
}

const AGENT = { 'x-admin-secret': 'test-admin-secret', 'content-type': 'application/json' };

/**
 * A tenant with the fake CRM's login and records loaded, made through the API as an agent would
 * when the journey needs one to exist, so every journey can run on its own.
 */
export async function ensureTenant(request: APIRequestContext): Promise<number> {
  const listed = (await (await request.get('/v1/admin/tenants', { headers: AGENT })).json()) as {
    tenants: { id: number; name: string }[];
  };
  let id = listed.tenants.find((tenant) => tenant.name.startsWith('Acme'))?.id;
  if (!id) {
    const made = await request.post('/v1/admin/tenants', {
      headers: AGENT,
      data: {
        name: 'Acme Mäkleri',
        active: true,
        connection: {
          provider: 'vitec',
          credentials: { username: USERNAME, password: PASSWORD },
          offices: [OFFICE],
          active: true,
        },
        sites: [{ label: 'acme.se', url: 'http://127.0.0.1:9/bell', active: true }],
      },
    });
    id = ((await made.json()) as { id: number }).id;
  }
  await expect
    .poll(
      async () =>
        (
          (await (
            await request.get(`/v1/admin/items?tenant=${id}&datatype=property`, { headers: AGENT })
          ).json()) as { total: number }
        ).total,
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(3);
  return id;
}

/** The toast that says what happened, by a part of its text. */
export const toast = (page: Page, text: string | RegExp) =>
  page.locator('[data-sonner-toast]').filter({ hasText: text }).first();
