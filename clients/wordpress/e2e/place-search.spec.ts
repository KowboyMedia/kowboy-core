/// <reference lib="dom" />
// The search box with pills on the Till salu page (docs/search.md, test 5), walked as a visitor
// walks it: open the list by a click and close it by a click outside, type, pick a place, see the
// pill and the cards change without a page load, pick one more by keyboard, take a pill away by
// its cross and by Backspace, and search words with and without a pill (Default 134), on the page
// and drawn again from the address; then the same box under a thumb on a phone. The names start
// with "journey:" so the acceptance report can name them under their criterion.
import { devices, expect, test, type Locator, type Page } from '@playwright/test';

/** The streets on the cards the list shows, in order. */
const streets = (page: Page): Locator => page.locator('[data-cards] .k-card__street');

/** The box's parts: the library's control (the field with the pills), its list and its options. */
const parts = (page: Page) => {
  const box = page.locator('[data-place-search]');
  return {
    box,
    control: box.locator('.ts-control'),
    field: box.getByRole('combobox', { name: 'Plats' }),
    list: box.locator('.ts-dropdown'),
    options: box.locator('.ts-dropdown .option'),
    pills: box.locator('.ts-control .item'),
  };
};

/** Every point sampled over the open list resolves to the list itself: nothing paints over it. */
async function paintedOnTop(page: Page, list: Locator): Promise<boolean> {
  const rect = (await list.boundingBox())!;
  const points: [number, number][] = [
    [rect.x + rect.width / 2, rect.y + rect.height / 2],
    [rect.x + 4, rect.y + rect.height - 4],
    [rect.x + rect.width - 4, rect.y + rect.height - 4],
  ];
  return page.evaluate((samples) => {
    return samples.every(([x, y]) => {
      let hit = document.elementFromPoint(x, y);
      while (hit && hit.shadowRoot) {
        const inside = hit.shadowRoot.elementFromPoint(x, y);
        if (!inside || inside === hit) break;
        hit = inside;
      }
      return hit !== null && hit.closest('.ts-dropdown') !== null;
    });
  }, points);
}

test('journey: a visitor narrows Till salu to places, takes them away again and searches words', async ({
  page,
}) => {
  await page.goto('/?pagename=till-salu');
  await expect(page.getByRole('heading', { name: 'Hitta din nya bostad' })).toBeVisible();
  await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);
  const { box, control, field, list, options, pills } = parts(page);

  // A click on the field opens the list, a click outside closes it, a click opens it again; the
  // open list is painted over everything under it, the cards' labels included (Patric's second
  // look, 2026-10-04). The suggestions are the places with a home for sale or coming, in three
  // groups, narrowed by the typed letters anywhere in the label, accents aside.
  await control.click();
  await expect(list).toBeVisible();
  expect(await paintedOnTop(page, list)).toBe(true);
  await expect(box.locator('.optgroup-header')).toHaveText(['Områden', 'Kommuner', 'Län']);
  await page.getByRole('heading', { name: 'Hitta din nya bostad' }).click();
  await expect(list).toBeHidden();
  await control.click();
  await expect(list).toBeVisible();
  await field.pressSequentially('Stock');
  await expect(options).toHaveText([
    'Norrmalm · Stockholm',
    'Vasastan · Stockholm',
    'Stockholm',
    'Stockholms län',
  ]);
  await field.clear();
  await field.pressSequentially('Norr');
  await expect(options).toHaveText(['Norrmalm · Stockholm']);

  // Choosing with the mouse: a pill in the field, the address, and the cards reloaded without a
  // page load. The pill grows the form downward: the field's top, the other fields and the
  // button keep their place on the page (Patric, 2026-10-04: the pills must not push the field up).
  const form = page.locator('.k-hero > form.k-search');
  await expect(form).toHaveCount(1);
  const button = page.getByRole('button', { name: 'Sök' });
  const price = form.locator('select[name="max_price"]');
  const measure = async () => ({
    control: (await control.boundingBox())!,
    price: (await price.boundingBox())!,
    button: (await button.boundingBox())!,
    form: (await form.boundingBox())!,
  });
  const before = await measure();
  expect(Math.abs(before.control.height - before.price.height)).toBeLessThan(1);
  await options.first().click();
  await expect(pills).toHaveText(['Norrmalm · Stockholm×']);
  await expect(field).toHaveValue('');
  await expect(list).toBeHidden();
  const after = await measure();
  expect(Math.abs(before.price.y - before.control.y)).toBeLessThan(1);
  expect(Math.abs(after.control.y - before.control.y)).toBeLessThan(1);
  expect(Math.abs(after.price.y - before.price.y)).toBeLessThan(1);
  expect(Math.abs(after.button.y - before.button.y)).toBeLessThan(1);
  expect(Math.abs(after.form.y - before.form.y)).toBeLessThan(1);
  expect(after.form.height).toBeGreaterThanOrEqual(before.form.height);
  // The pill grows the control by one line at most: the field wraps under it when the column is
  // too narrow for both (it is, at this width), never further.
  expect(after.control.height - before.control.height).toBeLessThanOrEqual(44);
  await expect(page).toHaveURL(/[?&]areas=D-2(&|$)/);
  await expect(streets(page)).toHaveText(['Kungsgatan 2']);

  // Choosing by keyboard: the first match is highlighted as one types and Enter takes it; the
  // places are one group, "any of these", so a second pill widens.
  await field.pressSequentially('Sollen');
  await expect(options).toHaveText(['Sollentuna']);
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await field.press('Enter');
  await expect(pills).toHaveText(['Norrmalm · Stockholm×', 'Sollentuna×']);
  await expect(page).toHaveURL(/[?&]lkf=0163(&|$)/);
  await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2']);

  // The cross on a pill takes it away; Backspace in the empty field takes the last one.
  await pills.first().getByTitle('Ta bort').click();
  await expect(pills).toHaveText(['Sollentuna×']);
  await expect(page).not.toHaveURL(/[?&]areas=/);
  await expect(streets(page)).toHaveText(['Kungsgatan 3']);
  await field.press('Backspace');
  await expect(pills).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]lkf=/);
  await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);

  // Words that are no place: the list says so and Enter sends them as free text, to the list on
  // the page and into the address, with the page kept and the words kept in the field.
  await field.pressSequentially('Kungsgatan 1');
  await expect(options).toHaveCount(0);
  await expect(list.locator('.no-results')).toHaveText(
    'Ingen plats matchar. Enter söker orden som text.',
  );
  await field.press('Enter');
  await expect(page).toHaveURL(/[?&]pagename=till-salu(&|$)/);
  await expect(page).toHaveURL(/[?&]q=Kungsgatan\+1(&|$)/);
  await expect(streets(page)).toHaveText(['Kungsgatan 1']);
  await expect(field).toHaveValue('Kungsgatan 1');
  await expect(list).toBeHidden();

  // Words with a pill, sent with the button: the pill says where and the words narrow within
  // it; the page drawn again from the address shows both.
  await field.clear();
  await field.pressSequentially('Vasa');
  await expect(options).toHaveText(['Vasastan · Stockholm']);
  await options.first().click();
  await expect(pills).toHaveText(['Vasastan · Stockholm×']);
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);
  await field.pressSequentially('Kungsgatan 2');
  await button.click();
  await expect(page).toHaveURL(/[?&]q=Kungsgatan\+2(&|$)/);
  await expect(page).toHaveURL(/[?&]areas=D-1(&|$)/);
  await expect(streets(page)).toHaveText(['Kungsgatan 2']);
  await expect(field).toHaveValue('Kungsgatan 2');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hitta din nya bostad' })).toBeVisible();
  await expect(parts(page).pills).toHaveText(['Vasastan · Stockholm×']);
  await expect(parts(page).field).toHaveValue('Kungsgatan 2');
  await expect(streets(page)).toHaveText(['Kungsgatan 2']);
});

test.describe('on a phone', () => {
  // The phone's screen, touch and user agent, in the same browser (its own engine would need
  // another worker, which a group may not ask for).
  const { defaultBrowserType: _engine, ...phone } = devices['iPhone 13'];
  test.use(phone);

  test('journey: under a thumb, a tap opens the box, a tap outside closes it and a tap chooses a place', async ({
    page,
  }) => {
    await page.goto('/?pagename=till-salu');
    await expect(page.getByRole('heading', { name: 'Hitta din nya bostad' })).toBeVisible();
    await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);
    const { control, list, options, pills } = parts(page);

    await control.tap();
    await expect(list).toBeVisible();
    await expect(options).toHaveText([
      'Norrmalm · Stockholm',
      'Vasastan · Stockholm',
      'Sollentuna',
      'Stockholm',
      'Stockholms län',
    ]);
    await page.getByRole('heading', { name: 'Hitta din nya bostad' }).tap();
    await expect(list).toBeHidden();
    await control.tap();
    await expect(list).toBeVisible();
    await options.nth(2).tap();
    await expect(pills).toHaveText(['Sollentuna×']);
    await expect(list).toBeHidden();
    await expect(page).toHaveURL(/[?&]lkf=0163(&|$)/);
    await expect(streets(page)).toHaveText(['Kungsgatan 3']);
    await pills.first().getByTitle('Ta bort').tap();
    await expect(pills).toHaveCount(0);
    await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);
  });
});
