<?php
// One agent's reviews as the testimonials' slides (core/list-testimonials.php), latest first, as
// the CRM holds them.
//
// In scope: $post_id, $item (the agent), $params.

declare(strict_types=1);

$reviews = [];
foreach (is_array($item['reviews'] ?? null) ? $item['reviews'] : [] as $review) {
    if (is_string($review['text'] ?? null) && trim($review['text']) !== '') {
        $reviews[] = ['quote' => $review['text'], 'author' => (string) ($review['author'] ?? '')];
    }
}
echo kowboy_testimonial_slides($reviews);
