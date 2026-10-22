/// <reference lib="dom" />
// The hero's photos move as a Ken Burns slideshow does (Patric, 2026-10-16: "the ken burns effect
// is currently only using zoom, while real ken burns have more styles"), walked on the home page:
// each photo has a motion of its own, zooming in and out and panning across; a photo out of view
// waits at the start of its motion, and a photo keeps moving until it has faded out, so it never
// jumps while it is in view; a visitor who asked for less motion sees the photos still. On a
// home's page the big photo shows the magnifier, moves on a drag without a jump (Patric,
// 2026-10-03: the property hero swipes) and opens every photo full screen on a click. The
// slider's own timer is stopped and the walk moves it on, so the walk never waits for the six
// seconds a photo is shown. The names start with "journey:" so the acceptance report can name them
// under their criterion.
import { expect, test, type Locator, type Page } from '@playwright/test';

/** A photo of the hero as the screen shows it right now. */
interface Photo {
  active: boolean;
  moving: boolean;
  animation: string;
  playState: string;
  transform: string;
  opacity: number;
}

/** A photo at rest, neither moved nor enlarged. */
const STILL = 'matrix(1, 0, 0, 1, 0, 0)';

const photos = (slider: Locator): Promise<Photo[]> =>
  slider.evaluate((element) =>
    Array.from(element.querySelectorAll('.k-hero__slide')).map((slide) => {
      const image = getComputedStyle(slide.querySelector('.k-hero__image') ?? slide);
      return {
        active: slide.classList.contains('swiper-slide-active'),
        moving: slide.classList.contains('is-moving'),
        animation: image.animationName,
        playState: image.animationPlayState,
        transform: image.transform,
        opacity: Number(getComputedStyle(slide).opacity),
      };
    }),
  );

const shown = async (slider: Locator): Promise<Photo> => {
  const active = (await photos(slider)).filter((photo) => photo.active);
  expect(active).toHaveLength(1);
  return active[0]!;
};

/** The slider's own timer stopped, and any fade it had started over. */
const hold = async (slider: Locator): Promise<void> => {
  await expect(slider).toHaveAttribute('data-ready', '1');
  await slider.evaluate((element) => {
    (element as HTMLElement & { swiper: { autoplay: { stop(): void } } }).swiper.autoplay.stop();
  });
  await expect
    .poll(() =>
      slider.evaluate(
        (element) => (element as HTMLElement & { swiper: { animating: boolean } }).swiper.animating,
      ),
    )
    .toBe(false);
};

const next = (slider: Locator): Promise<void> =>
  slider.evaluate((element) => {
    (element as HTMLElement & { swiper: { slideNext(): void } }).swiper.slideNext();
  });

/** Once a fade has ended, only the photo shown moves. */
const faded = (slider: Locator): Promise<void> =>
  expect
    .poll(async () => (await photos(slider)).filter((photo) => photo.moving).length, {
      timeout: 5_000,
    })
    .toBe(1);

/** The size and the shift of a photo, from its transform. */
const placed = (transform: string): number[] => {
  const values = /matrix\(([^)]+)\)/.exec(transform)?.[1]?.split(',').map(Number);
  return values === undefined ? [1, 0, 0] : [values[0]!, values[4]!, values[5]!];
};

/** What the pointer shows at a point, inside the shadow root the view may stand in. */
const cursorAt = (page: Page, x: number, y: number): Promise<string> =>
  page.evaluate(
    ([px, py]) => {
      let found = document.elementFromPoint(px!, py!);
      while (found?.shadowRoot) {
        const inner = found.shadowRoot.elementFromPoint(px!, py!);
        if (inner === null || inner === found) break;
        found = inner;
      }
      return found === null ? 'nothing' : getComputedStyle(found).cursor;
    },
    [x, y],
  );

test('journey: each hero photo moves its own way, and keeps moving until it has faded out', async ({
  page,
}) => {
  await page.goto('/');
  const slider = page.locator('[data-hero-slider]');
  await hold(slider);
  const first = await shown(slider);
  expect(first.animation).not.toBe('none');
  await expect.poll(async () => (await shown(slider)).transform).not.toBe(STILL);

  // The other photos wait at the start of their motions while they are out of view.
  const waiting = (await photos(slider)).filter((photo) => !photo.active);
  expect(waiting.map((photo) => photo.playState)).not.toContain('running');

  // The next photo fades in with a motion of its own, while the first fades out still moving.
  await next(slider);
  const second = await shown(slider);
  expect(second.animation).not.toBe('none');
  expect(second.animation).not.toBe(first.animation);
  let fading: Photo[] = [];
  await expect
    .poll(async () => {
      fading = (await photos(slider)).filter(
        (photo) => !photo.active && photo.opacity > 0.1 && photo.opacity < 0.9,
      );
      return fading.length;
    })
    .toBe(1);
  expect(fading[0]!.animation, 'the photo fading out').toBe(first.animation);
  expect(fading[0]!.playState, 'the photo fading out').toBe('running');
  expect(fading[0]!.transform, 'the photo fading out').not.toBe(STILL);
  await faded(slider);

  // Two more photos, each with a motion of its own: four photos, four motions. The slider moves
  // on only once a fade has ended.
  const motions = [first.animation, second.animation];
  for (const _ of [1, 2]) {
    await next(slider);
    motions.push((await shown(slider)).animation);
    await faded(slider);
  }
  expect(new Set(motions).size).toBe(4);

  // A visitor who asked for less motion sees the photo still.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await shown(slider)).animation).toBe('none');
  expect((await shown(slider)).transform).toBe(STILL);
});

test('journey: a home’s big photo shows the magnifier, follows a drag without a jump, and a click opens every photo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?post_type=core_property');
  await page.getByRole('link', { name: 'Kungsgatan 1', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kungsgatan 1' })).toBeVisible();
  const slider = page.locator('.k-hero--property [data-hero-slider]');
  await hold(slider);
  // A point on the photo above the address, which the text does not cover.
  const box = (await slider.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.3;
  expect(await cursorAt(page, x, y)).toBe('zoom-in');

  // Halfway through a drag the next photo shows the start of its motion, and once let go it
  // moves on from there.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - box.width * 0.6, y, { steps: 8 });
  let coming: Photo | undefined;
  await expect
    .poll(async () => {
      coming = (await photos(slider)).find((photo) => !photo.active && photo.opacity > 0.1);
      return coming !== undefined;
    })
    .toBe(true);
  const during = placed(coming!.transform);
  await page.mouse.up();
  await expect.poll(async () => (await shown(slider)).moving).toBe(true);
  const after = placed((await shown(slider)).transform);
  expect(Math.abs(after[0]! - during[0]!), 'the size, once let go').toBeLessThan(0.01);
  expect(Math.abs(after[1]! - during[1]!), 'the shift across, once let go').toBeLessThan(8);
  expect(Math.abs(after[2]! - during[2]!), 'the shift down, once let go').toBeLessThan(8);
  await expect(page.locator('.k-lightbox'), 'a drag is not a click').toHaveCount(0);

  // A click on the photo opens every photo full screen.
  await faded(slider);
  await page.mouse.click(x, y);
  await expect(page.locator('.k-lightbox')).toBeVisible();
});
