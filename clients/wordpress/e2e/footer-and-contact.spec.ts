/// <reference lib="dom" />
// A home without a viewing, and the footer, on a phone (Patric, 2026-10-04: "in mobile the page
// footer seems to have disappeared", and "some properties have, instead of a viewing slot, a
// contact button for the agent; this should scroll to the agent contact"), walked as a visitor on
// a phone: the home's page from the list, the header's menu still slides in from the hamburger,
// the button in the viewings' box takes the visitor to the agent's contact, and the footer's links
// are in view at the page's end. The name starts with "journey:" so the acceptance report can name
// it under its criterion.
import { devices, expect, test } from '@playwright/test';

test.describe('on a phone', () => {
  // The phone's screen, touch and user agent, in the same browser (its own engine would need
  // another worker, which a group may not ask for).
  const { defaultBrowserType: _engine, ...phone } = devices['iPhone 13'];
  test.use(phone);

  test('journey: without a viewing the contact button takes the visitor to the agent, and the footer menu is in view', async ({
    page,
  }) => {
    await page.goto('/?pagename=till-salu');
    await expect(page.getByRole('heading', { name: 'Hitta din nya bostad' })).toBeVisible();
    // Kungsgatan 1 has no viewing, so its page offers the contact button in place of a viewing.
    await page.getByRole('link', { name: 'Kungsgatan 1', exact: true }).tap();
    await expect(page.getByRole('heading', { level: 1, name: 'Kungsgatan 1' })).toBeVisible();

    // The header's menu is the only one that hides until the hamburger opens it.
    const headerItems = page.locator('.k-header__nav .k-menu li');
    await expect(headerItems.first()).toHaveCSS('opacity', '0');
    await page.getByRole('button', { name: 'Meny' }).tap();
    await expect(headerItems.first()).toHaveCSS('opacity', '1');
    await page.getByRole('button', { name: 'Meny' }).tap();
    await expect(headerItems.first()).toHaveCSS('opacity', '0');

    // The button lands on the agent's contact (the view is in a shadow root, which the browser's
    // own jump cannot see into): its block starts at the top of the screen, under its own small
    // margin, with the responsible agent's heading in view.
    const contact = page.locator('#k-agents');
    await page.getByRole('link', { name: 'Kontakta oss' }).tap();
    await expect
      .poll(() => contact.evaluate((el) => Math.round(el.getBoundingClientRect().top)))
      .toBeLessThanOrEqual(48);
    await expect
      .poll(() => contact.evaluate((el) => Math.round(el.getBoundingClientRect().top)))
      .toBeGreaterThanOrEqual(0);
    await expect(page.getByRole('heading', { name: 'Ansvarig mäklare' })).toBeInViewport();

    // The footer's links are in view at the end of the page, each painted in full.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footerItems = page.locator('.k-footer .k-menu li');
    expect(await footerItems.count()).toBeGreaterThan(0);
    for (const item of await footerItems.all()) {
      await expect(item).toHaveCSS('opacity', '1');
      await expect(item).toBeInViewport();
    }
  });
});
