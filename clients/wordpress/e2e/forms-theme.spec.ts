/// <reference lib="dom" />
// The three forms as the theme draws them (docs/forms.md, "Built 2026-10-06: the first version";
// questions 150 a and 155): on the real site each button opens the theme's own window, a booking
// reads the home's times through the plugin's receiver, each filled form goes to the plugin's
// other receiver with the bot check's proof, the plugin sends it on to Core with the site's token,
// and the fake CRM takes it. The browser never calls Core's addresses and never sees the token.
// Cloudflare's script is a stand-in here that hands out the dummy token of Cloudflare's test key,
// the one the test Core's bot check takes (acceptance/harness.ts). Every form ends with the
// optional step "Söker du bostad?", a search profile of its own. The name starts with "journey:"
// so the acceptance report can name it under its criterion.
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

test('journey: the interest, viewing and valuation buttons open the theme’s window, each form reaches the CRM through the site and Core with the bot check’s proof, “Söker du bostad?” follows each one as a search profile of its own, prefilled from the home, and the browser never calls Core', async ({
  page,
}) => {
  const authorized: string[] = [];
  const toCore: string[] = [];
  const leaked: string[] = [];
  const proofs: (string | undefined)[] = [];
  // What the window sent the site's receiver, in order.
  const sent: Record<string, unknown>[] = [];
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
      sent.push(JSON.parse(request.postData() ?? '{}') as Record<string, unknown>);
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

  // The interest: the window headed by the home, half a form refused in the window.
  await page.getByRole('link', { name: 'Anmäl intresse' }).click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'Är du intresserad av bostaden?' }),
  ).toBeVisible();
  await expect(dialog.getByText('Kungsgatan 3')).toBeVisible();
  await shot(page, '1-interest.png');
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByText('Fyll i alla fält')).toBeVisible();
  expect(answers).toEqual([]);
  // An address Core's schema would not take is asked again in the window, never sent. (The
  // browser itself writes a domain with å, ä or ö the way Core takes it, but not the name before @.)
  await fillPerson(dialog);
  await dialog.getByLabel('E-post').fill('änna@example.se');
  await dialog.getByLabel(/Jag samtycker/).check();
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByText('Fyll i alla fält')).toBeVisible();
  expect(answers).toEqual([]);
  await dialog.getByLabel('E-post').fill('anna@example.se');
  await dialog.getByLabel('Meddelande').fill('Jag vill gärna veta mer.');
  await shot(page, '2-interest-filled.png');
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  // The confirmation becomes the heading; the CRM took it through the site's receiver and Core.
  await expect(
    dialog.getByRole('heading', { name: 'Din intresseanmälan är skickad' }),
  ).toBeVisible();
  await expect(dialog.getByText('Mäklaren hör av sig', { exact: false })).toBeVisible();
  await expect.poll(() => answers.length).toBe(1);
  expect(answers[0]).toMatchObject({ status: 200, body: { status: 'delivered' } });
  // "Söker du bostad?" under the confirmation, prefilled with the closest values below the home's
  // 4 rooms and 110 kvm, with the current-home box of a home's form.
  await expect(dialog.getByRole('heading', { name: 'Söker du bostad?' })).toBeVisible();
  await expect(dialog.getByText('Steg 2 av 2 · valfritt')).toBeVisible();
  await expect(dialog.getByLabel('Minst antal rum')).toHaveValue('3');
  await expect(dialog.getByLabel('Minst boarea (kvm)')).toHaveValue('105');
  await shot(page, '3-interest-sent.png');
  await dialog.getByLabel('Minst boarea (kvm)').selectOption('100');
  await dialog.getByLabel('Kontakta mig om min nuvarande bostad.').check();
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByText('Tack!')).toBeVisible();
  await expect(
    dialog.getByText('Du får tips om nya bostäder som passar det du söker.'),
  ).toBeVisible();
  await shot(page, '3b-profile-sent.png');
  await expect.poll(() => answers.length).toBe(2);
  expect(answers[1]).toMatchObject({ status: 200, body: { status: 'delivered' } });
  // A search profile of its own, the person of the interest, the home's areas and kommun unseen.
  expect(sent[1]).toMatchObject({
    kind: 'search_profile',
    person: sent[0]!['person'],
    consent: sent[0]!['consent'],
    record: sent[0]!['record'],
    criteria: {
      object_type: null,
      rooms_min: 3,
      living_area_min: 100,
      areas: expect.arrayContaining([
        { id: 'D-1', name: 'Vasastan', county_municipality_code: '018001' },
      ]) as unknown,
      county_municipality_code: '0163',
    },
    contact_about_current_home: true,
  });
  expect(sent[1]!['id']).not.toBe(sent[0]!['id']);
  expect(sent[0]).not.toHaveProperty('contact_about_current_home');
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
  await expect(dialog.getByText('Steg 3 av 3 · valfritt')).toBeVisible();
  await shot(page, '6-booking-sent.png');
  await expect.poll(() => answers.length).toBe(3);
  expect(answers[2]).toMatchObject({ status: 200, body: { status: 'delivered' } });
  // Skipped, the profile is not sent and the window closes: the booking is in.
  await dialog.getByRole('button', { name: 'Hoppa över' }).click();
  await expect(dialog).toBeHidden();

  // The footer's free valuation: no home, the person remembered.
  await page.getByRole('link', { name: 'Boka fri värdering' }).click();
  await expect(dialog.getByRole('heading', { name: 'Ska du sälja din bostad?' })).toBeVisible();
  await expect(dialog.getByText('Kostnadsfri värdering')).toBeVisible();
  await expect(dialog.getByLabel('Förnamn')).toHaveValue('Anna');
  await dialog.getByLabel(/Jag samtycker/).check();
  await shot(page, '7-valuation.png');
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByRole('heading', { name: 'Tack, vi hör av oss' })).toBeVisible();
  await expect.poll(() => answers.length).toBe(4);
  expect(answers[3]).toMatchObject({ status: 200, body: { status: 'delivered' } });
  // No home: no minimum prefilled and no current-home box, since the visitor is a seller already.
  await expect(dialog.getByLabel('Minst antal rum')).toHaveValue('');
  await expect(dialog.getByLabel('Minst boarea (kvm)')).toHaveValue('');
  await expect(dialog.getByLabel('Kontakta mig om min nuvarande bostad.')).toBeHidden();
  await shot(page, '8-valuation-sent.png');
  await dialog.getByLabel('Minst antal rum').selectOption('2');
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByText('Tack!')).toBeVisible();
  await expect.poll(() => answers.length).toBe(5);
  expect(answers[4]).toMatchObject({ status: 200, body: { status: 'delivered' } });
  expect(sent[4]).toMatchObject({
    kind: 'search_profile',
    criteria: {
      object_type: null,
      rooms_min: 2,
      living_area_min: null,
      areas: [],
      county_municipality_code: null,
    },
  });
  expect(sent[4]).not.toHaveProperty('record');
  expect(sent[4]).not.toHaveProperty('contact_about_current_home');
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
  expect(proofs).toEqual(Array.from({ length: 5 }, () => HUMAN_TOKEN));
  expect(toCore).toEqual([]);
  expect(authorized).toEqual([]);
  expect(leaked).toEqual([]);
});

test('journey: while a form is on its way, “Skicka” reads “Skickar…” and cannot be pressed, so a second press or Enter sends nothing more, and the window has no field a person cannot see', async ({
  page,
}) => {
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STAND_IN }),
  );
  // The site's receiver holds the form until the test lets it go, as a slow CRM would.
  const posted: string[] = [];
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => /core\/v1\/forms(?!\/slots)/.test(decodeURIComponent(url.href)),
    async (route) => {
      if (route.request().method() === 'POST') {
        posted.push(route.request().postData() ?? '');
        await held;
      }
      await route.continue();
    },
  );

  await page.goto('/?pagename=till-salu');
  await page.getByRole('link', { name: 'Kungsgatan 3', exact: true }).click();
  const dialog = page.locator('dialog.k-form');
  await page.getByRole('link', { name: 'Anmäl intresse' }).click();
  await expect(dialog).toBeVisible();
  // The hidden trap field is gone (forms list, 2026-10-07): nothing in the window hides from people.
  await expect(
    dialog.locator('[aria-hidden="true"] input, input[tabindex="-1"], input[name="website"]'),
  ).toHaveCount(0);
  await fillPerson(dialog);
  await dialog.getByLabel(/Jag samtycker/).check();
  await dialog.getByRole('button', { name: 'Skicka' }).click();

  const sending = dialog.getByRole('button', { name: 'Skickar…' });
  await expect(sending).toBeDisabled();
  await expect.poll(() => posted.length).toBe(1);
  await sending.click({ force: true });
  await dialog.getByLabel('E-post').press('Enter');
  await expect(sending).toBeDisabled();
  release();

  await expect(
    dialog.getByRole('heading', { name: 'Din intresseanmälan är skickad' }),
  ).toBeVisible();
  expect(posted).toHaveLength(1);
});

for (const [how, answer] of [
  ['does not load', 'abort'],
  ['loads without the check in it', 'empty'],
] as const) {
  test(`journey: when the bot check cannot run in the browser (its script ${how}), the window still sends the form, says why it was not sent, and names the agent to contact instead, with no “Försök igen”`, async ({
    page,
  }) => {
    // Cloudflare's script fails: an ad blocker, a network that drops it, or a broken setup.
    await page.route('https://challenges.cloudflare.com/**', (route) =>
      answer === 'abort'
        ? route.abort()
        : route.fulfill({ contentType: 'text/javascript', body: '/* not the check */' }),
    );
    const proofs: (string | undefined)[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        decodeURIComponent(request.url()).includes('core/v1/forms')
      ) {
        proofs.push(request.headers()['x-core-human']);
      }
    });
    await page.goto('/?pagename=till-salu');
    await page.getByRole('link', { name: 'Kungsgatan 3', exact: true }).click();
    const dialog = page.locator('dialog.k-form');
    await page.getByRole('link', { name: 'Anmäl intresse' }).click();
    await fillPerson(dialog);
    await dialog.getByLabel(/Jag samtycker/).check();
    await dialog.getByRole('button', { name: 'Skicka' }).click();
    await expect(dialog.getByText('Det gick inte att skicka', { exact: true })).toBeVisible();
    await expect(
      dialog.getByText('Robotkontrollen fungerar inte just nu, så formuläret kunde inte skickas.', {
        exact: false,
      }),
    ).toBeVisible();
    // A form that could not be sent is not sent again: the home's agent is named instead.
    const elsewhere = dialog.locator('[data-form-elsewhere]');
    await expect(elsewhere).toHaveText(/^Kontakta mäklaren direkt i stället: (ring|mejla) .+\.$/);
    await expect(elsewhere.locator('a').first()).toHaveAttribute('href', /^(tel|mailto):.+/);
    await expect(dialog.getByRole('button', { name: 'Försök igen' })).toBeHidden();
    await dialog.getByRole('button', { name: 'Stäng', exact: true }).last().click();
    await expect(dialog).toBeHidden();
    expect(proofs).toEqual(['unavailable:script']);
  });
}

test('journey: with Kowboy’s chat on the page, a form button opens the chat at that request, and the theme’s window opens where the chat cannot take it', async ({
  page,
}) => {
  // The chat as far as the theme uses it: window.kowboyChat.open answers whether it took the request.
  // Here it takes interests and nothing else, as a chat would on a page where it cannot book.
  await page.addInitScript(() => {
    const asked: string[] = [];
    Object.assign(window, {
      chatAsked: asked,
      kowboyChat: { open: (action: string) => (asked.push(action), action === 'interest') },
    });
  });
  await page.goto('/?pagename=till-salu');
  await page.getByRole('link', { name: 'Kungsgatan 3', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kungsgatan 3' })).toBeVisible();
  // The chat reads the home's CRM id from the page, so the site needs no setting for it.
  expect(
    await page.locator('[data-kowboy-chat-listing-id]').getAttribute('data-kowboy-chat-listing-id'),
  ).toMatch(/\S/);
  const dialog = page.locator('dialog.k-form');
  const asked = () => page.evaluate(() => (window as unknown as { chatAsked: string[] }).chatAsked);

  await page.getByRole('link', { name: 'Anmäl intresse' }).click();
  expect(await asked()).toEqual(['interest']);
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: 'Boka fri värdering' }).click();
  expect(await asked()).toEqual(['interest', 'valuation']);
  await expect(dialog).toBeVisible();
});
