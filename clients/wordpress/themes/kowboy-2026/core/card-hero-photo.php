<?php
// One home's first photo (never a floor plan) as a slide of a hero (core/list-hero-photos.php).
//
// In scope: $post_id, $item (the home), $params.

declare(strict_types=1);

foreach (is_array($item['images'] ?? null) ? $item['images'] : [] as $photo) {
    if (($photo['category'] ?? null) !== 'Planritning' && is_string($photo['url'] ?? null) && $photo['url'] !== '') {
        $index = kowboy_hero_slide();
        // A landscape photo covering a portrait phone screen is about two and a half screen widths wide, so the file must be too.
        echo '<div class="swiper-slide k-hero__slide" data-index="' . $index . '">' . kowboy_image($photo['url'], '(max-width: 767px) 250vw, 100vw', (string) ($params['alt'] ?? ''), ['class' => 'k-hero__image'], $index === 0) . '</div>';
        return;
    }
}
