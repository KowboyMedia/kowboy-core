/// <reference lib="dom" />
// The hero's photos move as a Ken Burns slideshow does (Patric, 2026-10-16: "the ken burns effect
// is currently only using zoom, while real ken burns have more styles"), walked on the home page:
// each photo takes the next of the motions, zooms in and out and pans across, and a photo keeps
// moving until it has faded out, so it never jumps back while it is in view; a visitor who asked
// for less motion sees the photos still. The slider's own timer is stopped and the walk moves it
// on, so the walk never waits for the six seconds a photo is shown. The name starts with
// "journey:" so the acceptance report can name it under its criterion.
import { expect, test, type Locator } from '@playwright/test';

/** A photo of the hero as the screen shows it right now. */
interface Photo {
  active: boolean;
  motion: string | null;
  animation: string;
  transform: string;
  opacity: number;
}

/** A photo at rest, neither moved nor enlarged. */
const STILL = 'matrix(1, 0, 0, 1, 0, 0)';

const photos = (slider: Locator): Promise<Photo[]> =>
  slider.evaluate((element) =>
    Array.from(element.querySelectorAll('.k-hero__slide')).map((slide) => {
      const image = slide.querySelector('.k-hero__image') ?? slide;
      return {
        active: slide.classList.contains('swiper-slide-active'),
        motion: slide.getAttribute('data-motion'),
        animation: getComputedStyle(image).animationName,
        transform: getComputedStyle(image).transform,
        opacity: Number(getComputedStyle(slide).opacity),
      };
    }),
  );

const shown = async (slider: Locator): Promise<Photo> => {
  const active = (await photos(slider)).filter((photo) => photo.active);
  expect(active).toHaveLength(1);
  return active[0]!;
};

const next = (slider: Locator): Promise<void> =>
  slider.evaluate((element) => {
    (element as HTMLElement & { swiper: { slideNext(): void } }).swiper.slideNext();
  });

test('journey: each hero photo moves its own way, and keeps moving until it has faded out', async ({
  page,
}) => {
  await page.goto('/');
  const slider = page.locator('[data-hero-slider]');
  await expect(slider).toHaveAttribute('data-ready', '1');
  await slider.evaluate((element) => {
    (element as HTMLElement & { swiper: { autoplay: { stop(): void } } }).swiper.autoplay.stop();
  });
  const first = await shown(slider);
  expect(first.animation).not.toBe('none');
  await expect.poll(async () => (await shown(slider)).transform).not.toBe(STILL);

  // The next photo fades in with the next motion, while the first fades out still moving.
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
  expect(fading[0]!.transform, 'the photo fading out').not.toBe(STILL);

  // Once it has faded out, only the photo shown moves.
  const faded = (): Promise<void> =>
    expect
      .poll(async () => (await photos(slider)).filter((photo) => photo.motion !== null).length, {
        timeout: 5_000,
      })
      .toBe(1);
  await faded();

  // Two more photos, each with a motion of its own: four photos, four motions. The slider moves
  // on only once a fade has ended.
  const motions = [first.animation, second.animation];
  for (const _ of [1, 2]) {
    await next(slider);
    motions.push((await shown(slider)).animation);
    await faded();
  }
  expect(new Set(motions).size).toBe(4);

  // A visitor who asked for less motion sees the photo still.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await shown(slider)).animation).toBe('none');
  expect((await shown(slider)).transform).toBe(STILL);
});
