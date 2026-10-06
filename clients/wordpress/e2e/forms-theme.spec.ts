/// <reference lib="dom" />
// The interest form as the theme draws it (docs/forms.md, "Built 2026-10-06: the proof"; question
// 150 a): on the real site the button opens the theme's own window, the filled form goes to the
// plugin's receiver on the site, the plugin sends it on to Core with the site's token, and the
// fake CRM takes it. The browser never calls Core's doors and never sees the token. The name
// starts with "journey:" so the acceptance report can name it under its criterion.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** The test tenant's token (acceptance/harness.ts): what must never reach the browser. */
const TOKEN = 'test-tenant-token';
/** A folder for the window's screenshots, for a review of the look; none without it. */
const SHOTS = process.env['KOWBOY_SCREENSHOTS'];

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, name) });
}

test('journey: the interest button opens the theme’s window, the form reaches the CRM through the site and Core, and the browser never calls Core', async ({
  page,
}) => {
  const authorized: string[] = [];
  const toCore: string[] = [];
  const leaked: string[] = [];
  // What the site's receiver answered the browser, once it has; a holder, since a callback fills it.
  const seen: { receiver: { status: number; body: Record<string, unknown> } | null } = {
    receiver: null,
  };
  page.on('request', (request) => {
    if (request.headers()['authorization']) authorized.push(request.url());
    // Core's doors sit at the root of its address; the site's receiver is under its own API.
    if (/^\/v1\//.test(new URL(request.url()).pathname)) toCore.push(request.url());
  });
  page.on('response', (response) => {
    if (response.request().method() === 'POST' && response.url().includes('core/v1/forms')) {
      void response
        .json()
        .then((body: Record<string, unknown>) => {
          seen.receiver = { status: response.status(), body };
        })
        .catch(() => undefined);
    }
    const type = response.headers()['content-type'] ?? '';
    if (!/json|javascript|html/.test(type)) return;
    void response
      .text()
      .then((text) => {
        if (text.includes(TOKEN)) leaked.push(response.url());
      })
      .catch(() => undefined);
  });

  await page.goto('/?pagename=till-salu');
  await page.getByRole('link', { name: 'Kungsgatan 3', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kungsgatan 3' })).toBeVisible();

  // The button opens the theme's window, not the widget, headed by the home.
  const dialog = page.locator('dialog.k-form');
  await page.getByRole('link', { name: 'Anmäl intresse' }).click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'Är du intresserad av bostaden?' }),
  ).toBeVisible();
  await expect(dialog.getByText('Kungsgatan 3')).toBeVisible();
  await expect(page.locator('core-forms dialog')).toBeHidden();
  await shot(page, '1-window.png');

  // Half a form is refused in the window, before anything is sent.
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByText('Fyll i alla fält')).toBeVisible();
  expect(seen.receiver).toBeNull();

  // Inside the window: the widget's dialog, still on the page for the other forms, has the same labels.
  await dialog.getByLabel('Förnamn').fill('Anna');
  await dialog.getByLabel('Efternamn').fill('Svensson');
  await dialog.getByLabel('Mobil').fill('070-123 45 67');
  await dialog.getByLabel('E-post').fill('anna@example.se');
  await dialog.getByLabel('Meddelande').fill('Jag vill gärna veta mer.');
  await dialog.getByLabel(/Jag samtycker/).check();
  await shot(page, '2-filled.png');
  await dialog.getByRole('button', { name: 'Skicka' }).click();

  // The confirmation becomes the heading; the CRM took it through the site's receiver and Core.
  await expect(
    dialog.getByRole('heading', { name: 'Din intresseanmälan är skickad' }),
  ).toBeVisible();
  await expect(dialog.getByText('Mäklaren hör av sig', { exact: false })).toBeVisible();
  await shot(page, '3-sent.png');
  await expect.poll(() => seen.receiver?.status).toBe(200);
  expect(seen.receiver?.body['status']).toBe('delivered');
  await dialog.getByRole('button', { name: 'Klart' }).click();
  await expect(dialog).toBeHidden();

  // Opened again, the window remembers the person and offers to forget them.
  await page.getByRole('link', { name: 'Anmäl intresse' }).click();
  await expect(dialog.getByLabel('Förnamn')).toHaveValue('Anna');
  await expect(dialog.getByText('Vi minns dina uppgifter', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Glöm mig' }).click();
  await expect(dialog.getByLabel('Förnamn')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Stäng' }).click();
  await expect(dialog).toBeHidden();

  // The browser called none of Core's doors, used no token, and no answer carried it.
  expect(toCore).toEqual([]);
  expect(authorized).toEqual([]);
  expect(leaked).toEqual([]);
});
