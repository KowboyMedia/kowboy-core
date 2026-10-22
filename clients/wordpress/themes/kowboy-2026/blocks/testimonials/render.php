<?php
// The testimonials: the reviews Core carries on the agents (`reviews[]`, latest first per
// agent), as the CRM holds them (Patric, 2026-10-03); the block's own quotes only when Core
// has none, so a site without reviews in its CRM still shows what the editor wrote.

declare(strict_types=1);

$items = [];
if (function_exists('core_client_query')) {
    foreach (core_client_query(['entity' => 'agent', 'per_page' => 100])['items'] as $row) {
        foreach (is_array($row['item']['reviews'] ?? null) ? $row['item']['reviews'] : [] as $review) {
            if (is_string($review['text'] ?? null) && trim($review['text']) !== '') {
                $items[] = ['quote' => $review['text'], 'author' => (string) ($review['author'] ?? '')];
            }
        }
    }
}
if ($items === []) {
    $items = array_values(array_filter(is_array($attributes['items'] ?? null) ? $attributes['items'] : [], fn (array $item): bool => ($item['quote'] ?? '') !== ''));
}
if ($items === []) {
    return;
}
echo kowboy_section_open('k-testimonials');
echo '<div class="k-container"><div class="k-testimonials__head">';
if (($attributes['title'] ?? '') !== '') {
    echo '<h2 class="k-section__title">' . esc_html((string) $attributes['title']) . '</h2>';
}
echo '<div class="k-testimonials__arrows"><button class="k-arrow" type="button" data-prev aria-label="Föregående">&larr;</button><button class="k-arrow" type="button" data-next aria-label="Nästa">&rarr;</button></div></div>';
echo '<div class="swiper k-testimonials__slider" data-testimonials><div class="swiper-wrapper">';
foreach ($items as $item) {
    echo '<div class="swiper-slide"><blockquote class="k-testimonial"><p class="k-testimonial__quote">' . esc_html((string) $item['quote']) . '</p>';
    if (($item['author'] ?? '') !== '') {
        echo '<footer class="k-testimonial__author">' . esc_html((string) $item['author']) . '</footer>';
    }
    echo '</blockquote></div>';
}
echo '</div><div class="swiper-pagination"></div></div></div></section>';
