// One test per use case of docs/admin-panel-rebuild.md §1, walked as a person walks it. Each name
// starts with "journey:" so the acceptance report can name it under AC 42.
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
  page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: section }).click();

/** The tenant every later journey works on, made once by the first journey. */
const TENANT = 'Acme Mäklare';

async function openTenant(page: Page): Promise<void> {
  await go(page, 'Tenants');
  await page.getByRole('link', { name: TENANT }).click();
  await expect(page.getByRole('heading', { name: TENANT })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('journey: U1 onboard a customer, watch the first load, take the secrets', async ({ page }) => {
  await go(page, 'Tenants');
  await expect(page.getByText('No customer yet.', { exact: false })).toBeVisible();

  await page.getByRole('link', { name: 'Make the first tenant' }).click();
  await page.getByLabel('Name').first().fill(TENANT);

  await page.getByRole('button', { name: 'Add a CRM connection' }).click();
  await page.getByLabel('Short name').fill('acme-crm');
  await page.getByLabel('CRM').selectOption('fake-webhook');
  await page.getByLabel('Offices it may see').fill('100');
  await page.getByLabel('Pretend key').fill('a-key');

  // The login is tried before anything is saved.
  await page.getByRole('button', { name: 'Check the login' }).click();
  await expect(page.getByText('The CRM answers')).toBeVisible();

  await page.getByRole('button', { name: 'Add a site' }).click();
  await page.getByLabel('Name').last().fill('acme.se');
  await page.getByLabel('Where Core rings it').fill('http://127.0.0.1:9/bell');

  await page.getByTestId('save').click();
  await expect(page.getByText('Saved')).toBeVisible();
  await expect(page.getByText('added the connection acme-crm', { exact: false })).toBeVisible();

  // The token and the bell secret are on the page, each with a copy button.
  await expect(page.getByRole('button', { name: 'Copy the tenant token' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy the bell secret' })).toBeVisible();

  // The first load runs by itself and the page shows it without a reload.
  await expect(page.getByText('Loaded:', { exact: false })).toBeVisible({ timeout: 30_000 });
});

test('journey: U1 the page refuses what it cannot save, at the field', async ({ page }) => {
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
  await expect(page.getByText('The last 24 hours')).toBeVisible();
});

test('journey: U5 watch the flow — records in flight, coloured by state', async ({ page }) => {
  await go(page, 'Flow');
  await expect(page.getByRole('heading', { name: 'Flow' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'OBJ-1' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('tr.flow-fetched').first()).toBeVisible();
});

test('journey: U3 support a customer — find a record and see everything about it', async ({
  page,
}) => {
  await go(page, 'Records');
  await page.getByLabel('Words in the record').fill('kungsgatan');
  await expect(page.getByRole('link', { name: 'Kungsgatan 3' })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('link', { name: 'Kungsgatan 3' }).click();
  await expect(page.getByRole('heading', { name: 'The CRM’s payload' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The unified record' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The prepared strings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Its timeline' })).toBeVisible();
  // The history reads as sentences, not as payloads (Patric, 2026-09-21).
  await expect(page.getByRole('columnheader', { name: 'What happened' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'written', exact: false }).first()).toBeVisible();

  // What a recompute would change, without changing anything.
  await page.getByRole('button', { name: 'Preview a recompute' }).click();
  await expect(page.getByRole('heading', { name: 'What a recompute would change' })).toBeVisible();

  // The CRM, asked on the spot, writing nothing.
  await page.getByRole('button', { name: 'Ask the CRM now' }).click();
  await expect(page.getByRole('heading', { name: 'The CRM, just now' })).toBeVisible();
});

test('journey: U3 sort, page and choose the columns of the grid', async ({ page }) => {
  await go(page, 'Records');
  await page.getByLabel('Entity type').selectOption('property');
  await expect(page.getByRole('link', { name: 'Storgatan 12' })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Sort by Record id' }).click();
  await expect(page).toHaveURL(/sort=remote_id/);

  await page.getByRole('button', { name: 'Columns' }).click();
  await page.getByRole('checkbox', { name: 'Seq' }).check();
  await expect(page.getByRole('columnheader', { name: 'Seq' })).toBeVisible();
});

test('journey: U4 release safely — preview a scope, then run it as a job', async ({ page }) => {
  await go(page, 'Manual sync');
  await expect(page.getByRole('heading', { name: 'Manual sync' })).toBeVisible();
  // The scope is picked, never typed: a tenant, then its connection, then that connection's
  // office, then the entity (Patric, 2026-09-21).
  await page.getByLabel('Tenant').selectOption({ label: TENANT });
  await page.getByLabel('CRM connection').selectOption('acme-crm');
  await page.getByLabel('Office').selectOption('100');
  await page.getByLabel('Entity type').selectOption('property');
  await page.getByTestId('preview').click();
  await expect(page.getByTestId('preview-report')).toBeVisible();
  await expect(page.getByText('examined')).toBeVisible();

  // A run says what it will do before it does it.
  await page.getByRole('button', { name: 'Recompute', exact: true }).click();
  await expect(page.getByText('sold properties last', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Start the recompute' }).click();
  await expect(page.getByText('is queued for', { exact: false })).toBeVisible();
  await expect(page.getByRole('cell', { name: '#1' })).toBeVisible();
});

test('journey: U8 try things — ring a site and fetch a record again', async ({ page }) => {
  await openTenant(page);
  await page.getByRole('button', { name: 'Ring its sites' }).click();
  await expect(page.getByText('Rang every site of this tenant.')).toBeVisible();

  await go(page, 'Records');
  await page.getByRole('textbox', { name: 'Record id' }).fill('OBJ-1');
  await expect(page.getByRole('link', { name: 'Storgatan 12' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('checkbox', { name: 'Tick acme-crm|property|OBJ-1' }).check();
  // Fetching again asks the CRM for the same record and writes only what differs, so it asks
  // nothing first (Patric, 2026-09-21: it is not dangerous, it is idempotent).
  await page.getByRole('button', { name: 'Fetch again' }).click();
  await expect(page.getByText('fetched from the CRM again', { exact: false })).toBeVisible();
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
  await page.getByRole('button', { name: 'New token' }).click();
  await expect(page.getByText('stops syncing the moment', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Keep it as it is' }).click();

  await page.getByRole('button', { name: 'New token' }).click();
  await page.getByRole('button', { name: 'Make a new token' }).click();
  await expect(page.getByText('New token. Paste it into each site.')).toBeVisible();
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
  await expect(page.getByText('Maintenance is on.')).toBeVisible();

  await go(page, 'Overview');
  await expect(page.getByText('Maintenance is on.')).toBeVisible();

  await go(page, 'Settings');
  await page.getByRole('button', { name: 'Turn maintenance off' }).click();
  await page.getByRole('button', { name: 'Turn it off' }).click();
  await expect(page.getByText('the held bells go out now', { exact: false })).toBeVisible();
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
