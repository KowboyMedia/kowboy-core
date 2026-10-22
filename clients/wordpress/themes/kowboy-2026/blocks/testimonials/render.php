<?php
// The testimonials: the reviews Core carries on the agents (`reviews[]`, latest first per
// agent), as the CRM holds them (Patric, 2026-10-03); the block's own quotes only when Core
// has none, so a site without reviews in its CRM still shows what the editor wrote. The reviews
// are a list of the agents (core/list-testimonials.php), refreshed in the browser like every
// list, so a kept page shows them as they are now.

declare(strict_types=1);

$quotes = array_values(array_filter(is_array($attributes['items'] ?? null) ? $attributes['items'] : [], fn (array $item): bool => is_string($item['quote'] ?? null) && $item['quote'] !== ''));
$slider = '';
if (function_exists('core_client_list')) {
    kowboy_testimonial_quotes($quotes);
    $list = core_client_list(['entity' => 'agent', 'per_page' => 100, 'page' => 1, 'wrapper' => 'testimonials', 'card' => 'testimonials', 'styleisolation' => false]);
    // No review and no quote of the editor's: no section.
    $slider = $list['hash'] !== md5('') || $quotes !== [] ? $list['html'] : '';
} elseif ($quotes !== []) {
    $slider = '<div class="swiper k-testimonials__slider" data-testimonials><div class="swiper-wrapper">' . kowboy_testimonial_slides($quotes) . '</div><div class="swiper-pagination"></div></div>';
}
if ($slider === '') {
    return;
}
echo kowboy_section_open('k-testimonials');
echo '<div class="k-container"><div class="k-testimonials__head">';
if (($attributes['title'] ?? '') !== '') {
    echo '<h2 class="k-section__title">' . esc_html((string) $attributes['title']) . '</h2>';
}
echo '<div class="k-testimonials__arrows"><button class="k-arrow" type="button" data-prev aria-label="Föregående">&larr;</button><button class="k-arrow" type="button" data-next aria-label="Nästa">&rarr;</button></div></div>';
echo $slider;
echo '</div></section>';
