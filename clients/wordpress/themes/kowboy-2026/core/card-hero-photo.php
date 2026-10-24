<?php
// One home's photos (never a floor plan) as slides of a hero (core/list-hero-photos.php): up to
// five photos from the homes of the list, the first photo of each, then their second photos, and
// so on, so the slider shows different homes and still slides when only one or two are for sale
// (Patric, 2026-10-03: up to five, sliding). This card puts its own home's photos in, each with
// its place among all the slides, and the script puts the slides in that order.
//
// In scope: $post_id, $item (the home), $params, $position (the home's place in the list),
// $neighbours (the list's rows).

declare(strict_types=1);

$photos = array_map(function (array $row): array {
    $urls = [];
    foreach (is_array($row['item']['images'] ?? null) ? $row['item']['images'] : [] as $photo) {
        if (($photo['category'] ?? null) !== 'Planritning' && is_string($photo['url'] ?? null) && $photo['url'] !== '') {
            $urls[] = $photo['url'];
        }
    }
    return $urls;
}, $neighbours);
$most = max(1, (int) ($params['per_page'] ?? 5));
$slide = 0;
for ($round = 0; $slide < $most; $round++) {
    $found = false;
    foreach ($photos as $home => $urls) {
        if (!isset($urls[$round]) || $slide >= $most) {
            continue;
        }
        $found = true;
        if ($home === $position) {
            // A landscape photo covering a portrait phone screen is about two and a half screen widths wide, so the file must be too.
            echo '<div class="swiper-slide k-hero__slide" data-index="' . $slide . '">' . kowboy_image($urls[$round], '(max-width: 767px) 250vw, 100vw', (string) ($params['alt'] ?? ''), ['class' => 'k-hero__image'], $slide === 0) . '</div>';
        }
        $slide++;
    }
    if (!$found) {
        break;
    }
}
