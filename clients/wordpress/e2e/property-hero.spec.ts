/// <reference lib="dom" />
// A home's address and its pills on the hero (Patric, 2026-10-07: "If the pill and the address
// does not fit next to each other, instead left align both, instead of currently breaking them up
// and making linebreaks between the pills or between the street address parts"), walked on a wide
// screen and on a phone: when both fit, the address stands on the left of the row and the pills
// on its right; when they do not, the pills go under the address, both on the left, and neither
// breaks to make room for the other. The name starts with "journey:" so the acceptance report can
// name it under its criterion.
import { devices, expect, test, type Locator, type Page } from '@playwright/test';

/** Where a thing stands on the screen. */
const box = async (
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> => {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!;
};

/** The address block and the pills as the screen shows them, with the title's lines and the pills' rows counted. */
const hero = async (page: Page) => {
  const title = page.locator('.k-hero__title');
  const lineHeight = await title.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  const pillTops = await page
    .locator('.k-hero__facts .k-pill')
    .evaluateAll((pills) => pills.map((pill) => Math.round(pill.getBoundingClientRect().top)));
  return {
    main: await box(page.locator('.k-hero__head-main')),
    facts: await box(page.locator('.k-hero__facts')),
    titleLines: Math.round((await box(title)).height / lineHeight),
    pillRows: new Set(pillTops).size,
  };
};

/** Kungsgatan 3 from the list: a viewing is ahead, so its hero carries four pills. */
const openHome = async (page: Page): Promise<void> => {
  await page.goto('/?pagename=till-salu');
  await page.getByRole('link', { name: 'Kungsgatan 3', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kungsgatan 3' })).toBeVisible();
  await expect(page.locator('.k-hero__facts .k-pill')).toHaveCount(4);
};

test('journey: a home’s address and pills share the hero’s row when both fit, else the pills go under it, both on the left', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openHome(page);
  let now = await hero(page);
  // Both fit: one row, the pills right of the address, their lower edges level.
  expect(now.facts.x).toBeGreaterThan(now.main.x + now.main.width);
  expect(Math.abs(now.facts.y + now.facts.height - (now.main.y + now.main.height))).toBeLessThan(2);
  expect(now.titleLines).toBe(1);
  expect(now.pillRows).toBe(1);

  // A street too long to share the row with the pills: the pills go under it, on the left, in one
  // row, and the street stays on one line.
  await page.locator('.k-hero__title').evaluate((el) => {
    el.textContent = 'Gamla Drottning Kristinas väg\u00a0125\u00a0B';
  });
  now = await hero(page);
  expect(now.facts.y).toBeGreaterThanOrEqual(now.main.y + now.main.height);
  expect(Math.abs(now.facts.x - now.main.x)).toBeLessThan(1);
  expect(now.titleLines).toBe(1);
  expect(now.pillRows).toBe(1);
});

test.describe('on a phone', () => {
  // The phone's screen, touch and user agent, in the same browser (its own engine would need
  // another worker, which a group may not ask for).
  const { defaultBrowserType: _engine, ...phone } = devices['iPhone 13'];
  test.use(phone);

  test('journey: on a phone a home’s pills stand under its address, both on the left', async ({
    page,
  }) => {
    await openHome(page);
    const now = await hero(page);
    expect(now.facts.y).toBeGreaterThanOrEqual(now.main.y + now.main.height);
    expect(Math.abs(now.facts.x - now.main.x)).toBeLessThan(1);
    expect(now.titleLines).toBe(1);
  });
});
