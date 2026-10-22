/// <reference lib="dom" />
// The home page on a phone (Patric, 2026-10-07: "home page now got horizontal scroll, the
// protruding text seem to be the subtext under header "Till salu""), walked on an iPhone 13 and on
// the narrowest common phone, 320 px wide: the page does not scroll sideways, the list's lead and
// its three tabs stand inside the screen's margins, and each tab's word fits its tab. The name
// starts with "journey:" so the acceptance report can name it under its criterion.
import { devices, expect, test, type Locator } from '@playwright/test';

/** Where a thing's right edge stands on the screen. */
const rightEdge = async (locator: Locator): Promise<number> => {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!.x + found!.width;
};

test.describe('on a phone', () => {
  // The phone's screen, touch and user agent, in the same browser (its own engine would need
  // another worker, which a group may not ask for).
  const { defaultBrowserType: _engine, ...phone } = devices['iPhone 13'];
  test.use(phone);

  test('journey: the home page fits the screen, the list lead and its three tabs on it', async ({
    page,
  }) => {
    await page.goto('/');
    const lead = page.getByText('Nya bostäder varje vecka');
    const tabs = page.getByRole('tab');
    await expect(lead).toBeVisible();
    await expect(tabs).toHaveText(['Alla', 'Till salu', 'Kommande'], { ignoreCase: true });

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 700 });
      // The theme's side margin is 16 px, so nothing of the list's head reaches past width - 16.
      const margin = width - 16 + 0.5;
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `at ${String(width)} px`,
      ).toBe(width);
      expect(await rightEdge(lead), `the lead at ${String(width)} px`).toBeLessThanOrEqual(margin);
      expect(
        await rightEdge(page.getByRole('tablist')),
        `the tabs at ${String(width)} px`,
      ).toBeLessThanOrEqual(margin);
      const crammed = await tabs.evaluateAll((all) =>
        all.filter((tab) => tab.scrollWidth > tab.clientWidth).map((tab) => tab.textContent),
      );
      expect(crammed, `the tabs whose word does not fit at ${String(width)} px`).toEqual([]);
    }
  });
});
