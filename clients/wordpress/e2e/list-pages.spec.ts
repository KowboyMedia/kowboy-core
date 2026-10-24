/// <reference lib="dom" />
// A list's pages (next-steps item 31, Patric, 2026-10-15: lists "server side rendered first, then
// hydrated", with pages "somewhere linkable"), walked as a visitor on a page with two lists of
// homes, one and two cards a page: "Visa fler" loads the next home in place and keeps the address
// in step, a reload finds the list as it was left, and a stale copy of the page, as a page cache
// keeps one, shows the homes as they are now once it has loaded. The name starts with "journey:"
// so the acceptance report can name it under its criterion.
import { expect, test } from '@playwright/test';

test('journey: a list grows by Visa fler in place with its page in the address, a reload keeps it, and a stale copy of the page refreshes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const first = page.locator('.t-list').first();
  const streets = first.locator('[data-cards] .t-card__street');

  await page.goto('/?pagename=listor');
  await expect(streets).toHaveText(['Kungsgatan 3']);
  const more = first.getByRole('link', { name: 'Visa fler' });
  await more.click();
  await expect(streets).toHaveText(['Kungsgatan 3', 'Kungsgatan 2']);
  await expect(page).toHaveURL(/[?&]sida=2(&|$)/);
  // The second list keeps its own page: nothing of it is in the address.
  expect(page.url()).not.toContain('sida-2');
  await more.click();
  await expect(streets).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);
  await expect(page).toHaveURL(/[?&]sida=3(&|$)/);
  await expect(more).toBeHidden();

  // A reload, as the back button's may be, builds the same three homes on the server.
  await page.reload();
  await expect(streets).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);
  await expect(more).toBeHidden();

  // A copy of the first page made before Kungsgatan 3 came: the copy shows an old home in its
  // place, and the list refreshes itself to the homes there are now.
  await page.route(/[?&]pagename=listor$/, async (route) => {
    const response = await route.fetch();
    const html = (await response.text())
      .replace(/data-hash="[0-9a-f]+"/, 'data-hash="old"')
      .replace('Kungsgatan 3</span>', 'Gamla gatan 9</span>');
    await route.fulfill({ response, body: html });
  });
  await page.goto('/?pagename=listor');
  await expect(streets).toHaveText(['Kungsgatan 3']);
  await expect(first.getByText('Gamla gatan 9')).toHaveCount(0);
});
