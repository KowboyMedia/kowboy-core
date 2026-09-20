import { expect, test } from '@playwright/test';
import { ensureTenant, login } from './helpers';

test.describe('events, the audit trail, the adapter page, settings and the palette', () => {
  test('the log filters and pages, the audit trail says who did what, an adapter action runs, housekeeping runs, and the palette jumps to a tenant', async ({
    page,
  }) => {
    await ensureTenant(page.request);
    await login(page);
    await page.goto('/admin/events');
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
    await expect(page.locator('[data-event="entity.written"]').first()).toBeVisible();
    await page.getByRole('button', { name: 'Audit trail' }).click();
    await expect(page.locator('[data-event="admin.action"]').first()).toBeVisible();
    await expect(page.locator('[data-event="admin.action"]').first()).toContainText(
      'operator@example.test',
    );
    await page.getByRole('button', { name: 'Clear filters' }).click();

    // A filter value that is not a date is left out and said so.
    await page.goto('/admin/events?from=not-a-date');
    await expect(page.getByRole('status')).toContainText('is not a date');

    // Following a chain: a row's correlation id becomes the filter.
    await page.goto('/admin/events?type=entity.written');
    const chain = page.locator('[data-event="entity.written"] button').first();
    await chain.click();
    await expect(page).toHaveURL(/correlation=/);

    // The adapter's page: directions, settings and an action with its message.
    await page.goto('/admin/crm/vitec');
    await expect(page.getByRole('heading', { name: 'vitec' })).toBeVisible();
    await expect(page.getByText('Set up vitec')).toBeVisible();
    await expect(page.locator('[data-setting="VITEC_WEBHOOK_TOKEN"]')).toContainText('set');
    await page
      .locator('[data-section="Connections and schedules"]')
      .getByRole('button', { name: 'Compare now' })
      .first()
      .click();
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: 'compares its list' }),
    ).toBeVisible();

    // Settings: the configuration as it runs, and housekeeping now.
    await page.goto('/admin/settings');
    await expect(page.locator('[data-setting="Environment"]')).toContainText('local');
    await page.getByRole('button', { name: 'Run housekeeping now' }).click();
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: 'Housekeeping done' }),
    ).toBeVisible();

    // The command palette finds the tenant.
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByPlaceholder('A page, a tenant, or a record id…').fill('Acme');
    await page.getByRole('option', { name: /Acme/ }).click();
    await expect(page).toHaveURL(/\/admin\/tenants\/\d+$/);
  });
});
