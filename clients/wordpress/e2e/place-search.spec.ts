// The search box with pills on the Till salu page (docs/search.md, test 5), walked as a visitor
// walks it: type, pick a place, see the pill and the cards change without a page load, pick one
// more by keyboard, take a pill away by clicking it and by Backspace, and search words with and
// without a pill (Default 134), on the page and drawn again from the address. The name starts
// with "journey:" so the acceptance report can name it under its criterion.
import { expect, test, type Locator, type Page } from '@playwright/test';

/** The streets on the cards the list shows, in order. */
const streets = (page: Page): Locator => page.locator('[data-cards] .k-card__street');

test('journey: a visitor narrows Till salu to places, takes them away again and searches words', async ({
  page,
}) => {
  await page.goto('/?pagename=till-salu');
  await expect(page.getByRole('heading', { name: 'Hitta din nya bostad' })).toBeVisible();
  await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);

  const box = page.locator('[data-place-search]');
  const field = box.getByRole('combobox', { name: 'Plats' });
  const options = box.getByRole('option');
  const pills = box.locator('[data-pill-kind]');

  // The suggestions are the places with a home for sale or coming, in three groups, narrowed by
  // the typed letters at the start of the label or of a word in it.
  await field.fill('Stock');
  await expect(options).toHaveText([
    'Norrmalm · Stockholm',
    'Vasastan · Stockholm',
    'Stockholm',
    'Stockholms län',
  ]);
  await expect(box.locator('.core-place-search__group')).toHaveText(['Områden', 'Kommuner', 'Län']);
  await field.fill('Norr');
  await expect(options).toHaveText(['Norrmalm · Stockholm']);

  // Choosing with the mouse: a pill, the address, and the cards reloaded without a page load.
  // The pill grows the form downward: the field and the button keep their place on the page
  // (Patric, 2026-10-04: the pills must not push the field up).
  const form = page.locator('.k-hero > form.k-search');
  await expect(form).toHaveCount(1);
  const before = {
    field: (await field.boundingBox())!,
    button: (await page.getByRole('button', { name: 'Sök' }).boundingBox())!,
    form: (await form.boundingBox())!,
  };
  await options.first().click();
  await expect(pills).toHaveText(['Norrmalm · Stockholm ×']);
  await expect(field).toHaveValue('');
  const after = {
    field: (await field.boundingBox())!,
    button: (await page.getByRole('button', { name: 'Sök' }).boundingBox())!,
    form: (await form.boundingBox())!,
  };
  const middle = (box: { y: number; height: number }): number => box.y + box.height / 2;
  expect(Math.abs(middle(before.button) - middle(before.field))).toBeLessThan(1);
  expect(Math.abs(after.field.y - before.field.y)).toBeLessThan(1);
  expect(Math.abs(after.button.y - before.button.y)).toBeLessThan(1);
  expect(Math.abs(after.form.y - before.form.y)).toBeLessThan(1);
  expect(after.form.height).toBeGreaterThan(before.form.height + 20);
  await expect(page).toHaveURL(/[?&]areas=D-2(&|$)/);
  await expect(streets(page)).toHaveText(['Kungsgatan 2']);

  // Choosing by keyboard: the places are one group, "any of these", so a second pill widens.
  await field.fill('Sollen');
  await field.press('ArrowDown');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await field.press('Enter');
  await expect(pills).toHaveText(['Norrmalm · Stockholm ×', 'Sollentuna ×']);
  await expect(page).toHaveURL(/[?&]lkf=0163(&|$)/);
  await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2']);

  // A click on a pill takes it away; Backspace in the empty field takes the last one.
  await box.getByRole('button', { name: 'Ta bort Norrmalm · Stockholm' }).click();
  await expect(pills).toHaveText(['Sollentuna ×']);
  await expect(page).not.toHaveURL(/[?&]areas=/);
  await expect(streets(page)).toHaveText(['Kungsgatan 3']);
  await field.press('Backspace');
  await expect(pills).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]lkf=/);
  await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);

  // Words that are no place, sent with Enter: free text, to the list on the page and into the
  // address, with the page kept.
  await field.fill('Kungsgatan 1');
  await expect(options).toHaveCount(0);
  await field.press('Enter');
  await expect(page).toHaveURL(/[?&]pagename=till-salu(&|$)/);
  await expect(page).toHaveURL(/[?&]q=Kungsgatan\+1(&|$)/);
  await expect(streets(page)).toHaveText(['Kungsgatan 1']);
  await expect(field).toHaveValue('Kungsgatan 1');

  // Words with a pill, sent with the button: the pill says where and the words narrow within
  // it; the page drawn again from the address shows both.
  await field.fill('Vasa');
  await options.first().click();
  await expect(pills).toHaveText(['Vasastan · Stockholm ×']);
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(streets(page)).toHaveText(['Kungsgatan 3', 'Kungsgatan 2', 'Kungsgatan 1']);
  await field.fill('Kungsgatan 2');
  await page.getByRole('button', { name: 'Sök' }).click();
  await expect(page).toHaveURL(/[?&]q=Kungsgatan\+2(&|$)/);
  await expect(page).toHaveURL(/[?&]areas=D-1(&|$)/);
  await expect(streets(page)).toHaveText(['Kungsgatan 2']);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hitta din nya bostad' })).toBeVisible();
  await expect(box.locator('[data-pill-kind]')).toHaveText(['Vasastan · Stockholm ×']);
  await expect(box.getByRole('combobox', { name: 'Plats' })).toHaveValue('Kungsgatan 2');
  await expect(streets(page)).toHaveText(['Kungsgatan 2']);
});
