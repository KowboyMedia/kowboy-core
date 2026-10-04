/// <reference lib="dom" />
// The forms widget on the real site (docs/forms.md, acceptance criterion 48): the three buttons
// of the theme "Kowboy 2026" open Core's wizard, a visitor books a slot, sends an interest and
// asks for a valuation, each reaching the fake CRM through the real Core, and the browser never
// receives the tenant token or the CRM login. The name starts with "journey:" so the acceptance
// report can name it under its criterion.
import { expect, test, type Page } from '@playwright/test';

/** The test tenant's token (acceptance/harness.ts): what must never reach the browser. */
const TOKEN = 'test-tenant-token';

async function fillPerson(page: Page): Promise<void> {
  await page.getByLabel('Förnamn').fill('Anna');
  await page.getByLabel('Efternamn').fill('Svensson');
  await page.getByLabel('Mobil').fill('070-123 45 67');
  await page.getByLabel('E-post').fill('anna@example.se');
  await page.getByLabel(/Jag samtycker/).check();
}

test('journey: the three form buttons open the wizard, the forms reach the CRM through Core, and the browser never sees the tenant token', async ({
  page,
}) => {
  const authorized: string[] = [];
  const leaked: string[] = [];
  page.on('request', (request) => {
    if (request.headers()['authorization']) authorized.push(request.url());
  });
  page.on('response', (response) => {
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

  const dialog = page.locator('core-forms dialog');

  // The interest: the person, the send, the confirmation, the profile step prefilled from the home.
  await page.getByRole('link', { name: 'Anmäl intresse' }).click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'Är du intresserad av bostaden?' }),
  ).toBeVisible();
  await expect(dialog.getByText('Kungsgatan 3')).toBeVisible();
  await fillPerson(page);
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Din intresseanmälan är skickad' }),
  ).toBeVisible();
  await expect(dialog.getByText('Steg 2 av 2 · valfritt')).toBeVisible();
  // Kungsgatan 3 has 4 rooms and 110 kvm: the closest lower whitelisted values are prefilled.
  await expect(dialog.getByLabel('Minst antal rum')).toHaveValue('3');
  await expect(dialog.getByLabel('Minst boarea (kvm)')).toHaveValue('105');
  await expect(dialog.getByRole('button', { name: 'Vasastan' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Hoppa över' }).click();
  await expect(dialog.getByText('Ingen sökprofil skapades', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Klart' }).click();
  await expect(dialog).toBeHidden();

  // The booking: the slots read live, the full one disabled, the person remembered from the
  // interest, the confirmation naming the slot, then the profile sent.
  await page.getByRole('link', { name: 'Boka här' }).click();
  await expect(dialog.getByRole('heading', { name: 'Boka visning' })).toBeVisible();
  const slots = dialog.getByRole('radio');
  await expect(slots).toHaveCount(2);
  await expect(slots.nth(1)).toBeDisabled();
  await expect(slots.nth(1)).toContainText('Fullbokad');
  await slots.nth(0).click();
  await dialog.getByRole('button', { name: 'Fortsätt' }).click();
  await expect(page.getByLabel('Förnamn')).toHaveValue('Anna');
  await expect(dialog.getByText('Vi minns dina uppgifter', { exact: false })).toBeVisible();
  await page.getByLabel(/Jag samtycker/).check();
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByRole('heading', { name: 'Din plats är bokad' })).toBeVisible();
  await expect(dialog.getByText('Steg 3 av 3 · valfritt')).toBeVisible();
  await dialog.getByRole('button', { name: 'Norrmalm' }).click();
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByText('Du får tips om nya bostäder', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Klart' }).click();

  // The footer's free valuation: no home, no area preselected, the seller's lead.
  await page.getByRole('link', { name: 'Boka fri värdering' }).click();
  await expect(dialog.getByRole('heading', { name: 'Ska du sälja din bostad?' })).toBeVisible();
  await page.getByLabel(/Jag samtycker/).check();
  await dialog.getByRole('button', { name: 'Skicka' }).click();
  await expect(dialog.getByRole('heading', { name: 'Tack, vi hör av oss' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Vasastan' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(dialog.getByLabel('Minst antal rum')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Hoppa över' }).click();
  await dialog.getByRole('button', { name: 'Klart' }).click();
  await expect(dialog).toBeHidden();

  // The page never used the tenant token, and no answer carried it.
  expect(authorized).toEqual([]);
  expect(leaked).toEqual([]);
});
