import { expect, test } from '@playwright/test';
import { OPERATOR, login } from './helpers';

test.describe('logging in', () => {
  test('an allowed address gets a link by mail and is in; a stranger gets the same answer and no link', async ({
    page,
  }) => {
    await page.goto('/admin/');
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByLabel('Your email address').fill('someone@elsewhere.test');
    await page.getByRole('button', { name: 'Send me a link' }).click();
    await expect(page.getByRole('status')).toContainText(
      'If that address may log in, a link is on its way',
    );
    const before = (
      (await (await page.request.get('/__e2e/mails')).json()) as { mails: { to: string }[] }
    ).mails;
    expect(before.some((mail) => mail.to === 'someone@elsewhere.test')).toBe(false);

    await login(page, OPERATOR);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByTestId('user-menu')).toContainText(OPERATOR);
    await expect(page.getByTestId('environment')).toHaveText('local');
    await expect(page.getByTestId('stream')).toHaveAttribute('data-state', 'live');

    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto('/admin/tenants');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
