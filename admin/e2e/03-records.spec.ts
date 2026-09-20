import { expect, test } from '@playwright/test';
import { ensureTenant, login } from './helpers';

test.describe('records and recomputes', () => {
  test('the search filters and sorts on the server, a selection previews a recompute, the job runs for real, and a record shows its three faces and timeline', async ({
    page,
  }) => {
    await ensureTenant(page.request);
    await login(page);
    await page.goto('/admin/records');
    await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible();
    await expect(page.locator('[data-tile="Live records"]')).toContainText('5');

    // Filter to properties, sort by record id ascending.
    await page.getByRole('combobox').nth(2).click();
    await page.getByRole('option', { name: 'property' }).click();
    await expect(page.locator('table[data-slot=table]').first().locator('tbody tr')).toHaveCount(3);
    await page.getByRole('button', { name: 'Record id' }).click();
    await page.getByRole('button', { name: 'Record id' }).click();
    await expect(
      page.locator('table[data-slot=table]').first().locator('tbody tr').first(),
    ).toContainText('OBJ1');
    await expect(page).toHaveURL(/sort=remote_id/);

    // Free text finds a record by a word in it.
    await page.getByLabel('Search words').fill('Storgatan');
    await expect(page.locator('table[data-slot=table]').first().locator('tbody tr')).toHaveCount(3);
    await page.getByLabel('Search words').fill('nothingliketh');
    await expect(page.getByText('No record matches these filters.')).toBeVisible();
    await page.getByLabel('Search words').fill('');

    // Tick two rows, preview a recompute, run it for real.
    await page.getByLabel('Select this row').nth(0).check();
    await page.getByLabel('Select this row').nth(1).check();
    await expect(page.getByTestId('selection-bar')).toContainText('2 selected');
    await page.getByTestId('selection-bar').getByTestId('preview').click();
    await expect(page).toHaveURL(/\/admin\/jobs\/\d+$/);
    await expect(page.getByRole('heading', { name: /Preview #\d+/ })).toBeVisible();
    await expect(page.locator('[data-tile="Examined"]')).toContainText('2', { timeout: 30_000 });
    await expect(page.getByText('done').first()).toBeVisible();
    await page.getByTestId('run-for-real').click();
    await page.getByTestId('confirm').click();
    await expect(page.getByRole('heading', { name: /Recompute #\d+/ })).toBeVisible();
    await expect(page.locator('[data-tile="Examined"]')).toContainText('2', { timeout: 30_000 });

    // The jobs page keeps the history; a scope of everything can be previewed from there.
    await page.goto('/admin/jobs');
    await expect(page.locator('table[data-slot=table] tbody tr')).toHaveCount(2);
    await page.getByRole('button', { name: /Preview: everything/ }).click();
    await expect(page.getByRole('heading', { name: /Preview #\d+/ })).toBeVisible();
    await expect(page.locator('[data-tile="Examined"]')).toContainText('5', { timeout: 30_000 });

    // One record: three faces side by side and its timeline down to the recompute.
    await page.goto('/admin/records?datatype=property');
    await page.getByRole('link', { name: 'OBJ1' }).first().click();
    await expect(page.getByRole('heading', { name: 'OBJ1' })).toBeVisible();
    await expect(page.locator('[data-json="Raw, as the CRM sent it"]')).toBeVisible();
    await expect(page.locator('[data-json="Unified"]')).toBeVisible();
    await expect(page.locator('[data-json="Display"]')).toBeVisible();
    await expect(page.locator('[data-event="entity.written"]').first()).toBeVisible();

    // The live activity list shows the records that came through, coloured by state.
    await page.goto('/admin/records');
    await expect(page.locator('[data-state-name="written"]').first()).toBeVisible();
  });
});
