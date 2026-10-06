// One test per use case of docs/admin-panel-rebuild.md §1, walked as a person walks it. Each name
// starts with "journey:" so the acceptance report can name it under AC 42.
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const EMAIL = 'tester@kowboy.se';

/** Sign in as a person does: ask for a link, open the one that comes back, land in the area. */
async function signIn(page: Page, remember = false): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Your address').fill(EMAIL);
  if (remember) await page.getByLabel('Remember this device').check();
  await page.getByRole('button', { name: 'Send me a link' }).click();
  const link = page.getByTestId('sign-in-link');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
}

/** The navigation on the left, so a link on a page never stands in for a section. */
const go = (page: Page, section: string): Promise<void> =>
  page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: section, exact: true })
    .click();

/** Tick one thing in a scope box (Tenants, Offices, Entity types), as a person does. */
async function tick(page: Page, box: string, item: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${box}`) }).click();
  await page.getByRole('menuitemcheckbox', { name: item, exact: true }).click();
  await page.keyboard.press('Escape');
}

/** The tenant every later journey works on, made once by the first journey. */
const TENANT = 'Acme Mäklare';

async function openTenant(page: Page): Promise<void> {
  await go(page, 'Tenants');
  await page.getByRole('link', { name: TENANT }).click();
  await expect(page.getByRole('heading', { name: TENANT, exact: true })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('journey: U1 onboard a customer, watch the first load, take the secrets', async ({ page }) => {
  await go(page, 'Tenants');
  await expect(page.getByText('No tenant yet.', { exact: false })).toBeVisible();

  await page.getByRole('link', { name: 'Make the first tenant' }).click();
  await page.getByLabel('Name', { exact: true }).fill(TENANT);

  await page.getByRole('button', { name: 'Add a CRM connection' }).click();
  const connection = page.getByRole('region', { name: 'A new CRM connection' });
  await connection.getByLabel('Name', { exact: true }).fill('acme-crm');
  await connection.getByLabel('CRM', { exact: true }).selectOption('fake-webhook');
  await connection.getByLabel('Pretend key').fill('a-key');

  // The login is tried before anything is saved.
  await connection.getByRole('button', { name: 'Check login' }).click();
  await expect(connection.getByText('The CRM takes the login.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Add a site' }).click();
  const site = page.getByRole('region', { name: 'A new site' });
  await site.getByLabel('Address').fill('http://127.0.0.1:9');
  await site.getByLabel('Bell path').fill('/bell');

  await page.getByTestId('save').click();
  await expect(page.getByText('short name acme-crm, is added', { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/tenants\/\d+$/);

  // The token and the bell secret are on the page, each with a copy button.
  await expect(page.getByRole('button', { name: 'Copy the tenant token' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy the bell secret' })).toBeVisible();

  // The first load runs by itself, and the tenant's records on their way show it without a reload.
  await expect(page.getByRole('link', { name: 'Storgatan 12' })).toBeVisible({ timeout: 30_000 });

  // A login field that is not secret shows what Core holds, read back from Core.
  await page.reload();
  await expect(
    page.getByRole('region', { name: /short name acme-crm$/ }).getByLabel('Pretend key'),
  ).toHaveValue('a-key');
});

test('journey: U1 the page refuses what it cannot save, and says why', async ({ page }) => {
  await go(page, 'Tenants');
  await page.getByRole('link', { name: 'New tenant' }).click();
  await page.getByTestId('save').click();
  await expect(page.getByText('A tenant needs a name.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/tenants\/new/);
});

test('journey: U2 keep it healthy — the verdict, and where a red check is fixed', async ({
  page,
}) => {
  await expect(page.getByTestId('verdict')).toBeVisible();
  await expect(page.getByTestId('check-database')).toContainText('ok');
  await expect(page.getByTestId('environment')).toBeVisible();
  await expect(page.getByTestId('attention')).toContainText('Needs attention');
  await expect(page.getByText('The last 24 hours')).toBeVisible();
});

test('journey: U5 watch the flow — records in flight, coloured by state, by tenant', async ({
  page,
}) => {
  await go(page, 'Flow');
  await expect(page.getByRole('heading', { name: 'Flow' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Storgatan 12' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('tr.flow-fetched').first()).toBeVisible();
  // When each was queued comes first, and the list is sorted by it (Patric, 2026-10-06).
  await expect(page.getByRole('columnheader').first()).toHaveText(/Queued at/);
  await tick(page, 'Tenants', TENANT);
  await expect(page).toHaveURL(/tenant=\d+/);
  await expect(page.getByRole('link', { name: 'Storgatan 12' })).toBeVisible();
});

test('journey: U3 support a customer — find a record, follow it to the sites, see its data', async ({
  page,
}) => {
  await go(page, 'Records');
  await page.getByLabel('One record, by the CRM’s id').fill('OBJ-2');
  await expect(page.getByRole('link', { name: 'Kungsgatan 3' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Storgatan 12' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Kungsgatan 3' }).click();
  await expect(page.getByRole('heading', { name: 'Kungsgatan 3' })).toBeVisible();
  // Where it is: in the CRM, in Core and on each site of the tenant, each step with its retry.
  await expect(page.getByRole('heading', { name: 'Where it is now' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3. On the sites' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send again' })).toBeVisible();
  // The history reads as sentences, one change at a time (Patric, 2026-09-21).
  await expect(page.getByRole('heading', { name: 'What happened' })).toBeVisible();
  await expect(page.getByText(/^Written/).first()).toBeVisible();
  // Its data in three forms, one at a time.
  await page.getByRole('tab', { name: 'What the CRM sent' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Kungsgatan 3');

  // The CRM, asked on the spot, writing nothing.
  await page.getByRole('button', { name: 'Compare with the CRM now' }).click();
  await expect(page.getByText('The CRM’s answer matches Core’s copy.')).toBeVisible();
});

test('journey: U3 scope, sort and choose the columns of the grid', async ({ page }) => {
  await go(page, 'Records');
  // The same scope as Manual sync: tenants, offices, entity types and one record id.
  await tick(page, 'Entity types', 'Homes');
  await expect(page).toHaveURL(/datatype=property/);
  await expect(page.getByRole('link', { name: 'Storgatan 12' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Lidingö', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sort by What it is' }).click();
  await expect(page).toHaveURL(/sort=remote_id/);

  await page.getByRole('button', { name: 'Columns' }).click();
  await page.getByRole('checkbox', { name: 'CRM connection' }).check();
  await expect(page.getByRole('columnheader', { name: 'CRM connection' })).toBeVisible();

  // Live, removed or both; nothing has been removed yet.
  await page.getByRole('button', { name: 'Removed', exact: true }).click();
  await expect(page.getByText('No record matches what is picked.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Both', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Storgatan 12' })).toBeVisible();
});

test('journey: U4 manual sync — pick a scope and how far to go, then watch it', async ({
  page,
}) => {
  await go(page, 'Manual sync');
  await expect(page.getByRole('heading', { name: 'Manual sync', exact: true })).toBeVisible();
  // The scope is picked, never typed (Patric, 2026-09-21), and the same as on Records.
  await tick(page, 'Tenants', TENANT);
  await tick(page, 'Offices', 'Lidingö (office id 100)');
  await tick(page, 'Entity types', 'Homes');
  await expect(page.getByTestId('covers')).toContainText('3 live records now');

  // The full level is the default; a shorter one is a pick, and it says what it does first.
  await expect(page.getByRole('radio', { name: /^Fetch from the CRM/ })).toBeChecked();
  await page.getByRole('radio', { name: /^Send to the sites only/ }).check();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Nothing is fetched or computed.');
  await page.getByRole('button', { name: 'Start it' }).click();
  await expect(
    page.getByText(
      'Core sent 3 records to the sites of Acme Mäklare again, and told them to fetch them.',
      { exact: false },
    ),
  ).toBeVisible();

  // The full level for one record, its id typed key by key: the CRM is asked again, and the list
  // below, the same as the Flow page, shows what that fetch found.
  await page.getByLabel('One record, by the CRM’s id').pressSequentially('OBJ-2');
  await expect(page).toHaveURL(/id=OBJ-2/);
  await expect(page.getByTestId('covers')).toContainText('1 live record now');
  await page.getByRole('radio', { name: /^Fetch from the CRM/ }).check();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('The CRM is called.');
  await page.getByRole('button', { name: 'Start it' }).click();
  await expect(
    page.getByText('Core asks the CRM for 1 record again.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.locator('tr.flow-row', { hasText: 'identical to what Core held' }),
  ).toBeVisible();
});

test('journey: U8 try things — send a record to the sites again, and fetch it again', async ({
  page,
}) => {
  await go(page, 'Records');
  await page.getByLabel('One record, by the CRM’s id').fill('OBJ-1');
  await page.getByRole('link', { name: 'Storgatan 12' }).click();
  await expect(page.getByRole('heading', { name: 'Storgatan 12' })).toBeVisible();
  // Each step tries again at once and asks nothing first: it only repeats what Core does anyway.
  await page.getByRole('button', { name: 'Send again' }).click();
  await expect(
    page.getByText(
      'Core sent 1 record to the sites of Acme Mäklare again, and told them to fetch it.',
      { exact: false },
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fetch again' }).click();
  await expect(
    page.getByText('Core asks the CRM for 1 record again.', { exact: false }),
  ).toBeVisible();
});

test('journey: failed forms — read a form the CRM did not take, and send it again', async ({
  page,
}) => {
  // A visitor's interest in a home, sent the way a site's server sends it, with the tenant's
  // token. This Core is not the live service, so the form stops before the CRM and is kept.
  await openTenant(page);
  const token = await page
    .getByRole('button', { name: 'Copy the tenant token' })
    .locator('xpath=preceding-sibling::code')
    .innerText();
  const sent = await page.request.post('/v1/submissions', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      id: randomUUID(),
      kind: 'interest',
      record: { datatype: 'property', connection_id: 'acme-crm', remote_id: 'OBJ-1' },
      person: {
        first_name: 'Anna',
        last_name: 'Svensson',
        email: 'anna@example.se',
        phone: '0701234567',
      },
      message: 'Hej! Jag vill gärna veta mer om bostaden.',
      consent: { given: true, at: new Date().toISOString() },
    },
  });
  expect(sent.status(), await sent.text()).toBe(409);

  await go(page, 'Failed forms');
  const form = page.getByTestId('failed-form');
  await expect(form).toHaveCount(1);
  await expect(form.getByText('Anna Svensson')).toBeVisible();
  await expect(form.getByText('anna@example.se')).toBeVisible();
  await expect(form.getByText('Hej! Jag vill gärna veta mer om bostaden.')).toBeVisible();
  // Core's own hold outside production says so in words, not in the site's Swedish answer.
  await expect(form.getByText('Held back', { exact: true })).toBeVisible();
  await expect(
    form.getByText('Held back: only production sends forms to a CRM', { exact: false }),
  ).toBeVisible();
  // The home by its address, then the CRM's id for it.
  await expect(form.getByRole('link', { name: 'Storgatan 12' })).toBeVisible();
  await expect(form.getByText('the CRM’s id OBJ-1', { exact: false })).toBeVisible();

  // The button says beside it what it does, and asks before it sends.
  await expect(
    form.getByText('Sends this form to the CRM once more.', { exact: false }),
  ).toBeVisible();
  await form.getByRole('button', { name: 'Send again' }).click();
  await page.getByRole('button', { name: 'Send it' }).click();
  await expect(
    page.getByText('Held back again: only production sends forms to a CRM.', { exact: false }),
  ).toBeVisible();
  await expect(form).toHaveCount(1);
});

test('journey: U7 configure an adapter — its directions, settings and actions', async ({
  page,
}) => {
  await go(page, 'CRMs');
  await page.getByRole('link', { name: 'fake-webhook' }).click();
  await expect(page.getByText('Setting it up')).toBeVisible();
  await expect(page.getByText('Fetch list')).toBeVisible();
  await page.getByRole('button', { name: 'Fetch everything waiting now' }).first().click();
  await expect(page.getByText('Everything waiting is fetched.')).toBeVisible();
});

test('journey: U6 secrets — rotating a token says what breaks, and asks first', async ({
  page,
}) => {
  await openTenant(page);
  await page.getByRole('button', { name: 'Make a new token' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The old token stops working at once.');
  await dialog.getByRole('button', { name: 'Keep it as it is' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Make a new token' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Make a new token' }).click();
  await expect(page.getByText('Core made a new token.', { exact: false })).toBeVisible();
});

test('journey: U6 remember this device, and see every device it is signed in on', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Send me a link' })).toBeVisible();
  await signIn(page, true);

  await go(page, 'Settings');
  await expect(page.getByRole('heading', { name: 'Your devices' })).toBeVisible();
  await expect(page.getByText('this one')).toBeVisible();
  await expect(page.getByRole('cell', { name: '30 days' }).first()).toBeVisible();
});

test('journey: U6 the event log says who did what', async ({ page }) => {
  await go(page, 'Events');
  await page.getByRole('button', { name: 'Saves' }).click();
  await expect(page.getByText(EMAIL).first()).toBeVisible();
});

test('journey: U6 maintenance pauses Core’s own work, and says so everywhere', async ({ page }) => {
  await go(page, 'Settings');
  await page.getByRole('button', { name: 'Turn maintenance on' }).click();
  await page.getByRole('button', { name: 'Turn it on' }).click();
  // The card itself says so, by offering the switch the other way.
  await expect(page.getByRole('button', { name: 'Turn maintenance off' })).toBeVisible();

  // The page itself, not the toast that is still fading on top of it.
  await go(page, 'Overview');
  await expect(page.getByRole('main').getByText('Maintenance is on.')).toBeVisible();

  await go(page, 'Settings');
  await page.getByRole('button', { name: 'Turn maintenance off' }).click();
  await page.getByRole('button', { name: 'Turn it off' }).click();
  await expect(page.getByText('the held bells go out now', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn maintenance on' })).toBeVisible();
});

test('journey: the palette goes anywhere, and sign-out ends the session', async ({ page }) => {
  // The keys open it, and so does the button that spells them out for anyone who does not know
  // them (Patric, 2026-09-21: "⌘K" — what is this?).
  await page.getByRole('button', { name: 'Go to…' }).click();
  await expect(page.getByPlaceholder('Go to a page')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByPlaceholder('Go to a page').fill('Records');
  await page.getByRole('option', { name: 'Records' }).first().click();
  await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Send me a link' })).toBeVisible();
});
