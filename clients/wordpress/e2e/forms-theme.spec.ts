/// <reference lib="dom" />
// The three forms as the theme draws them (docs/forms.md, "Built 2026-10-06: the first version";
// questions 150 a and 155): on the real site each button opens the theme's own window, a booking
// reads the home's times through the plugin's receiver, each filled form goes to the plugin's
// other receiver with the bot check's proof, the plugin sends it on to Core with the site's token,
// and the fake CRM takes it. The browser never calls Core's addresses and never sees the token.
// Cloudflare's script is a stand-in here that hands out the dummy token of Cloudflare's test key,
// the one the test Core's bot check takes (acceptance/harness.ts). The name starts with
// "journey:" so the acceptance report can name it under its criterion.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** The test tenant's token (acceptance/harness.ts): what must never reach the browser. */
const TOKEN = 'test-tenant-token';
/** The token Cloudflare's test key hands out, which the test Core's bot check takes. */
const HUMAN_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
/** A folder for the window's screenshots, for a review of the look; none without it. */
const SHOTS = process.env['KOWBOY_SCREENSHOTS'];

/** Cloudflare's script, as far as the window uses it: a challenge that passes at once, again after a reset. */
const TURNSTILE_STAND_IN = `
window.turnstile = (function () {
  var widgets = {};
  var count = 0;
  function pass(id) {
    setTimeout(function () { widgets[id].callback('${HUMAN_TOKEN}'); }, 50);
  }
  return {
    render: function (element, options) {
      count += 1;
      var id = 'w' + count;
      widgets[id] = options;
      element.setAttribute('data-stand-in', options.sitekey);
      pass(id);
      return id;
    },
    reset: function (id) { pass(id); },
    remove: function (id) { delete widgets[id]; },
  };
})();
`;

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, name) });
}

async function fillPerson(dialog: Locator): Promise<void> {
  await dialog.getByLabel('Förnamn').fill('Anna');
  await dialog.getByLabel('Efternamn').fill('Svensson');
  await dialog.getByLabel('Mobil').fill('070-123 45 67');
  await dialog.getByLabel('E-post').fill('anna@example.se');
}

test('journey: the interest, viewing and valuation buttons open the theme’s window, each form reaches the CRM through the site and Core with the bot check’s proof, and the browser never calls Core', async ({
  page,
}) => {
  const authorized: string[] = [];
  const toCore: string[] = [];
  const leaked: string[] = [];
  const proofs: (string | undefined)[] = [];
  // What the site's receivers answered the browser, in order; a callback fills it.
  const answers: { status: number; body: Record<string, unknown> }[] = [];
  let timesRead = 0;
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STAND_IN }),
  );
  page.on('request', (request) => {
    if (request.headers()['authorization']) authorized.push(request.url());
    // Core's addresses sit at the root of its own address; the site's receivers are under its API.
    if (/^\/v1\//.test(new URL(request.url()).pathname)) toCore.push(request.url());
    if (
      request.method() === 'POST' &&
      decodeURIComponent(request.url()).includes('core/v1/forms')
    ) {
      proofs.push(request.headers()['x-core-human']);
    }
  });
  page.on('response', (response) => {
    // Without pretty permalinks the receivers' address is a query, written out encoded.
    const address = decodeURIComponent(response.url());
    if (address.includes('core/v1/forms/slots')) timesRead += 1;
    if (response.request().method() === 'POST' && address.includes('core/v1/forms')) {
      void response
        .json()
        .then((body: Record<string, unknown>) => {
          answers.push({ status: response.status(), body });
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
  const dialog = page.locator('dialog.k-form');

  // The interest: the window headed by the home, the current-home box, half a form refused in the window.
  await page.getByRole('link', { name: 'Anmäl intresse' }).click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'Är du intresserad av bostaden?' }),
  ).toBeVisible();
  await expect(dialog.getByText('Kungsgatan 3')).toBeVisible();
  await expect(dialog.getByLabel('Kontakta mig om min nuvarande bostad.')).toBeVisible();
  await shot(page, '1-interest.png');
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByText('Fyll i alla fält')).toBeVisible();
  expect(answers).toEqual([]);
  await fillPerson(dialog);
  await dialog.getByLabel('Meddelande').fill('Jag vill gärna veta mer.');
  await dialog.getByLabel(/Jag samtycker/).check();
  await shot(page, '2-interest-filled.png');
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  // The confirmation becomes the heading; the CRM took it through the site's receiver and Core.
  await expect(
    dialog.getByRole('heading', { name: 'Din intresseanmälan är skickad' }),
  ).toBeVisible();
  await expect(dialog.getByText('Mäklaren hör av sig', { exact: false })).toBeVisible();
  await shot(page, '3-interest-sent.png');
  await expect.poll(() => answers.length).toBe(1);
  expect(answers[0]).toMatchObject({ status: 200, body: { status: 'delivered' } });
  await dialog.getByRole('button', { name: 'Klart' }).click();
  await expect(dialog).toBeHidden();

  // The booking: the times read live through the site, the full one disabled, the person
  // remembered from the interest, the confirmation naming the time.
  await page.getByRole('link', { name: 'Boka här' }).click();
  await expect(dialog.getByRole('heading', { name: 'Boka visning' })).toBeVisible();
  await expect(dialog.getByText('Kungsgatan 3')).toBeVisible();
  const times = dialog.getByRole('radio');
  await expect(times).toHaveCount(2);
  expect(timesRead).toBe(1);
  await expect(times.nth(0)).toContainText('4 platser kvar');
  await expect(times.nth(1)).toBeDisabled();
  await expect(times.nth(1)).toContainText('Fullbokad');
  // The viewing's own button, with one free time: that time is picked.
  await expect(times.nth(0)).toHaveAttribute('aria-checked', 'true');
  const time = ((await times.nth(0).locator('span').textContent()) ?? '').trim();
  expect(time).toMatch(/^\p{L}+dag \d+ \p{L}+ · \d\d\.\d\d–\d\d\.\d\d$/u);
  await shot(page, '4-booking-times.png');
  await dialog.getByRole('button', { name: 'Fortsätt' }).click();
  await expect(dialog.getByLabel('Förnamn')).toHaveValue('Anna');
  await expect(dialog.getByText('Vi minns dina uppgifter', { exact: false })).toBeVisible();
  await dialog.getByLabel(/Jag samtycker/).check();
  await shot(page, '5-booking-person.png');
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByRole('heading', { name: 'Din plats är bokad' })).toBeVisible();
  await expect(
    dialog.getByText(`Kungsgatan 3 · ${time}. Du får en bekräftelse från mäklaren.`),
  ).toBeVisible();
  await shot(page, '6-booking-sent.png');
  await expect.poll(() => answers.length).toBe(2);
  expect(answers[1]).toMatchObject({ status: 200, body: { status: 'delivered' } });
  await dialog.getByRole('button', { name: 'Klart' }).click();

  // The footer's free valuation: no home and no current-home box, the person remembered.
  await page.getByRole('link', { name: 'Boka fri värdering' }).click();
  await expect(dialog.getByRole('heading', { name: 'Ska du sälja din bostad?' })).toBeVisible();
  await expect(dialog.getByText('Kostnadsfri värdering')).toBeVisible();
  await expect(dialog.getByLabel('Kontakta mig om min nuvarande bostad.')).toBeHidden();
  await expect(dialog.getByLabel('Förnamn')).toHaveValue('Anna');
  await dialog.getByLabel(/Jag samtycker/).check();
  await shot(page, '7-valuation.png');
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByRole('heading', { name: 'Tack, vi hör av oss' })).toBeVisible();
  await shot(page, '8-valuation-sent.png');
  await expect.poll(() => answers.length).toBe(3);
  expect(answers[2]).toMatchObject({ status: 200, body: { status: 'delivered' } });
  await dialog.getByRole('button', { name: 'Klart' }).click();
  await expect(dialog).toBeHidden();

  // Opened again, the window offers to forget the person.
  await page.getByRole('link', { name: 'Boka fri värdering' }).click();
  await dialog.getByRole('button', { name: 'Glöm mig' }).click();
  await expect(dialog.getByLabel('Förnamn')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Stäng' }).click();
  await expect(dialog).toBeHidden();

  // Every form carried the bot check's proof; the browser called none of Core's addresses, used
  // no token, and no answer carried it.
  expect(proofs).toEqual([HUMAN_TOKEN, HUMAN_TOKEN, HUMAN_TOKEN]);
  expect(toCore).toEqual([]);
  expect(authorized).toEqual([]);
  expect(leaked).toEqual([]);
});
