<?php
// The photos of a record (a property, an area), one component for both (Patric, 2026-10-03):
// on a phone a full-height Swiper slider of every photo first (a trial beside the grid), then
// the grid with "Visa fler bilder"; a tap or click on a photo opens the full-screen slider.
// Every file at the CDN's widths, the slot's size per width, so the browser weighs the pixel
// density in; a phone's cover-cropped landscape photo needs about two and a half screen widths.
//
// In scope: $photos (image arrays), $alt (string).

declare(strict_types=1);

$alt = (string) ($alt ?? '');
$full = array_map(fn (array $image): string => kowboy_image_at((string) ($image['url'] ?? ''), 1920), $photos);
if ($photos === []) {
    return;
}
?>
<div class="k-container k-gallery" data-gallery data-images="<?php echo esc_attr((string) wp_json_encode($full, JSON_UNESCAPED_SLASHES)); ?>">
    <div class="swiper k-photos" data-photo-slider aria-label="Bilder">
        <div class="swiper-wrapper">
            <?php foreach ($photos as $index => $photo) : ?>
                <div class="swiper-slide k-photos__slide" data-lightbox="<?php echo (int) $index; ?>"><?php echo kowboy_image($photo, '250vw', $alt, ['class' => 'k-photos__image']); ?></div>
            <?php endforeach; ?>
        </div>
        <div class="swiper-pagination k-photos__count"></div>
    </div>
    <div class="k-gallery__grid">
        <?php foreach ($photos as $index => $photo) : ?>
            <figure class="k-gallery__item<?php echo $index >= 6 ? ' is-collapsed' : ''; ?>"><button class="k-gallery__button" type="button" data-lightbox="<?php echo (int) $index; ?>" aria-label="Visa bild <?php echo (int) $index + 1; ?> i helskärm"><?php echo kowboy_image($photo, '(min-width: 1024px) 384px, (min-width: 768px) 50vw, 100vw', $alt, ['class' => 'k-gallery__image']); ?></button></figure>
        <?php endforeach; ?>
    </div>
    <?php if (count($photos) > 6) : ?><p class="k-gallery__more"><button class="k-button" type="button" data-gallery-more>Visa fler bilder</button></p><?php endif; ?>
</div>
