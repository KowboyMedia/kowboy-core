<?php
declare(strict_types=1);

$items = array_filter(is_array($attributes['items'] ?? null) ? $attributes['items'] : [], fn (array $item): bool => ($item['title'] ?? '') !== '');
echo kowboy_section_open('k-features');
echo '<div class="k-container">';
if (($attributes['text'] ?? '') !== '') {
    echo '<p class="k-features__text">' . esc_html((string) $attributes['text']) . '</p>';
}
if ($items !== []) {
    echo '<div class="k-features__grid">';
    $number = 0;
    foreach ($items as $item) {
        $number += 1;
        echo '<div class="k-feature"><span class="k-feature__badge">' . esc_html(str_pad((string) $number, 2, '0', STR_PAD_LEFT)) . '</span>';
        echo '<h3 class="k-feature__title">' . esc_html((string) $item['title']) . '</h3>';
        echo '<p class="k-feature__text">' . esc_html((string) ($item['text'] ?? '')) . '</p></div>';
    }
    echo '</div>';
}
if (($attributes['closing'] ?? '') !== '') {
    echo '<p class="k-features__closing">' . esc_html((string) $attributes['closing']) . '</p>';
}
echo '</div></section>';
