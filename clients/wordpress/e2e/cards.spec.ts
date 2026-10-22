/// <reference lib="dom" />
// Every card that leads somewhere shows it (Patric, 2026-10-16: "some cards seem to be missing the
// mouse cursor indicating that it is clickable"), walked with a mouse on a wide screen: over the
// whole face of a home's card, an area's, an association's and an agent's the pointer is the hand,
// and a click on a home's photo, on its status pill or on an agent's title leads to the record's
// page as a click on the name does. The dots over a home's photos are bright on the screen, not
// only in their style (Patric, the same day: "make it a bit brighter", and on 2026-10-19 "still not
// done lighter": the card's dark fade lay over them), and a click that just misses one changes the photo, never the
// page. The name starts with "journey:" so the acceptance report can name it under its criterion.
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The points of a grid over a card (nine rows of five) where the screen does not show the hand,
 * each with the cursor it shows and what is under it. The card is brought to the middle of the
 * screen first, at once, so every point is on the screen.
 */
const pointsWithoutHand = (card: Locator): Promise<string[]> =>
  card.evaluate((element) => {
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
    // What the pointer is over at a point, inside the shadow root the view may stand in.
    const under = (x: number, y: number): Element | null => {
      let found = document.elementFromPoint(x, y);
      while (found?.shadowRoot) {
        const inner = found.shadowRoot.elementFromPoint(x, y);
        if (inner === null || inner === found) break;
        found = inner;
      }
      return found;
    };
    const box = element.getBoundingClientRect();
    const misses: string[] = [];
    for (let row = 1; row <= 9; row++) {
      for (let column = 1; column <= 5; column++) {
        const thing = under(box.left + (box.width * column) / 6, box.top + (box.height * row) / 10);
        const cursor = thing === null ? 'nothing' : getComputedStyle(thing).cursor;
        if (cursor !== 'pointer') {
          misses.push(
            `row ${String(row)}, column ${String(column)}: ${cursor} over ${thing?.className ?? ''}`,
          );
        }
      }
    }
    return misses;
  });

/**
 * How bright a thing shows on the screen, from 0 (black) to 255 (white): the brightest pixel of
 * its picture, read by the browser itself, so whatever lies over it counts.
 */
const brightness = async (page: Page, thing: Locator): Promise<number> => {
  const picture = (await thing.screenshot()).toString('base64');
  return page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (context === null) return 0;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let most = 0;
    for (let at = 0; at < data.length; at += 4) {
      most = Math.max(most, ((data[at] ?? 0) + (data[at + 1] ?? 0) + (data[at + 2] ?? 0)) / 3);
    }
    return Math.round(most);
  }, picture);
};

/** A plain click where a thing stands on the screen, as a visitor's mouse makes it. */
const clickOn = async (page: Page, thing: Locator): Promise<void> => {
  await thing.evaluate((element) =>
    element.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  const box = await thing.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
};

test('journey: every card shows the hand over its whole face and leads to its page from anywhere on it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  // Homes: every home here has two photos, so each card is a slider with two dots.
  await page.goto('/?post_type=core_property');
  const home = page.locator('.k-card', { hasText: 'Kungsgatan 1' });
  await expect(home.locator('[data-card-slider]')).toHaveAttribute('data-ready', '1');
  expect(await pointsWithoutHand(home)).toEqual([]);
  const dots = home.locator('.swiper-pagination-bullet');
  await expect(dots).toHaveCount(2);
  const shown = home.locator('.swiper-pagination-bullet-active');
  const other = home.locator('.swiper-pagination-bullet:not(.swiper-pagination-bullet-active)');
  // The dot of the photo shown is white on the screen, the other nearly so.
  expect(await brightness(page, shown), 'the dot of the photo shown').toBeGreaterThanOrEqual(245);
  expect(await brightness(page, other), 'the other dot').toBeGreaterThanOrEqual(200);

  // A click that just misses the other dot shows that dot's photo and stays on the page.
  const otherIndex = await dots.evaluateAll((all) =>
    all.findIndex((one) => !one.classList.contains('swiper-pagination-bullet-active')),
  );
  const dot = await other.boundingBox();
  expect(dot).not.toBeNull();
  await page.mouse.click(dot!.x + dot!.width + 3, dot!.y + dot!.height / 2);
  await expect(dots.nth(otherIndex)).toHaveClass(/swiper-pagination-bullet-active/);
  await expect(page).toHaveURL(/post_type=core_property/);

  // A click on the photo leads to the home, and so does a click on the status pill over it.
  await clickOn(page, home.locator('.swiper-slide-active img'));
  await expect(page.getByRole('heading', { level: 1, name: 'Kungsgatan 1' })).toBeVisible();
  await page.goBack();
  await clickOn(
    page,
    page.locator('.k-card', { hasText: 'Kungsgatan 2' }).locator('.k-card__status'),
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Kungsgatan 2' })).toBeVisible();

  // Areas and associations: the whole card is one link.
  await page.goto('/?post_type=core_area');
  expect(await pointsWithoutHand(page.locator('.k-card', { hasText: 'Vasastan' }))).toEqual([]);
  await page.goto('/?post_type=core_association');
  expect(await pointsWithoutHand(page.locator('.k-card', { hasText: 'Brf Solgården' }))).toEqual(
    [],
  );

  // Agents: the hand over the picture and the lines on it; a click on the title leads to the agent.
  await page.goto('/?post_type=core_agent');
  const agent = page.locator('.k-agent-card', { hasText: 'Anna Andersson' });
  expect(await pointsWithoutHand(agent)).toEqual([]);
  await clickOn(page, agent.locator('.k-agent-card__title'));
  await expect(page.getByRole('heading', { level: 1, name: 'Anna Andersson' })).toBeVisible();
});
