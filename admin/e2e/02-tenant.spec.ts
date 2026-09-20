import { expect, test } from '@playwright/test';
import { OFFICE, PASSWORD, USERNAME, login, toast } from './helpers';

test.describe('onboarding a customer', () => {
  test('one page makes the tenant with its CRM login, offices and sites, loads its records, and changes it on the same page', async ({
    page,
  }) => {
    await login(page);
    await page.getByRole('link', { name: 'Tenants' }).first().click();
    await page.getByRole('link', { name: 'New tenant' }).click();
    await expect(page.getByRole('heading', { name: 'Make a tenant' })).toBeVisible();

    // Saving with nothing filled in shows the errors at the fields and saves nothing.
    await page.getByTestId('save').click();
    await expect(page.getByText('Give the tenant a name.')).toBeVisible();

    await page.getByLabel('Name').fill('Acme Mäkleri');
    await page.getByLabel('CRM').click();
    await page.getByRole('option', { name: 'vitec' }).click();
    await expect(page.getByTestId('crm-panel')).toBeVisible();
    await page.getByLabel('Connect username').fill(USERNAME);
    await page.getByLabel('Connect password').fill('wrong');
    await page.getByLabel('Offices').fill(OFFICE);
    await page.getByTestId('probe').click();
    await expect(page.getByTestId('probe-result')).toContainText('No');
    await page.getByLabel('Connect password').fill(PASSWORD);
    await page.getByTestId('probe').click();
    await expect(page.getByTestId('probe-result')).toContainText('Yes');

    await page.getByTestId('add-site').click();
    await page.getByLabel('Name', { exact: true }).nth(1).fill('acme.se');
    await page.getByLabel('Bell URL').fill('not a url');
    await page.getByTestId('save').click();
    await expect(page.getByText('The bell URL must start with http:// or https://.')).toBeVisible();
    await page.getByLabel('Bell URL').fill('http://127.0.0.1:9/bell');
    await page.getByTestId('save').click();

    await expect(toast(page, 'Loading every record of 1 office(s) from vitec now')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/tenants\/\d+$/);
    await expect(page.getByRole('heading', { name: 'Acme Mäkleri' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy token' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy secret' })).toBeVisible();
    await expect(page.locator('[data-site="acme.se"]')).toBeVisible();

    // The worker loads the records from the (fake) CRM; the page shows them without a reload.
    await expect(page.getByText('Records are loaded')).toBeVisible();
    await expect(page.locator('[data-section="Records here and on the sites"]')).toContainText(
      'property',
      { timeout: 30_000 },
    );
    await expect(
      page
        .locator('[data-section="Records here and on the sites"] tr')
        .filter({ hasText: 'property' }),
    ).toContainText('3', { timeout: 30_000 });

    // Change it on the same page: a rename, and a second site.
    await page.getByLabel('Name', { exact: true }).first().fill('Acme Mäkleri AB');
    await page.getByTestId('add-site').click();
    await page.getByLabel('Name', { exact: true }).last().fill('acme-two.se');
    await page.getByLabel('Bell URL').last().fill('http://127.0.0.1:9/bell-two');
    await page.getByTestId('save').click();
    await expect(toast(page, 'acme-two.se has its bell secret')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Acme Mäkleri AB' })).toBeVisible();
    await expect(page.locator('[data-site="acme-two.se"]')).toBeVisible();

    // A new token, after a confirmation that says what it costs.
    const before = await page.locator('[data-section="Token"] code').innerText();
    await page.getByRole('button', { name: 'New token' }).click();
    await page.getByTestId('confirm').click();
    await expect(toast(page, 'New token')).toBeVisible();
    await expect(page.locator('[data-section="Token"] code')).not.toHaveText(before);

    // What the adapter knows sits under the connection, with its run-now actions.
    await expect(page.locator('[data-section="What Vitec knows"]')).toBeVisible();
    await page
      .locator('[data-section="What Vitec knows"]')
      .getByRole('button', { name: 'Catch up now' })
      .click();
    await expect(toast(page, 'catches up at the worker’s next tick')).toBeVisible();

    // Look at a record from the CRM: raw, unified and display, nothing written.
    await page.getByLabel('Record id').fill('OBJ1');
    await page.getByTestId('look').click();
    await expect(page.locator('[data-json="Raw, as the CRM sent it"]')).toBeVisible();
    await expect(page.locator('[data-json="Display"]')).toBeVisible();
  });
});
