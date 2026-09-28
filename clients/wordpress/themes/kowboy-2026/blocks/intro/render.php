<?php
declare(strict_types=1);

$figures = array_filter(is_array($attributes['figures'] ?? null) ? $attributes['figures'] : [], fn (array $figure): bool => ($figure['value'] ?? '') !== '');
echo kowboy_section_open('k-intro');
echo '<div class="k-container"><div class="k-intro__card">';
if (($attributes['label'] ?? '') !== '') {
    echo '<p class="k-label">' . esc_html((string) $attributes['label']) . '</p>';
}
if (($attributes['title'] ?? '') !== '') {
    echo '<h2 class="k-intro__title">' . esc_html((string) $attributes['title']) . '</h2>';
}
if (($attributes['text'] ?? '') !== '') {
    echo '<p class="k-intro__text">' . esc_html((string) $attributes['text']) . '</p>';
}
if ($figures !== []) {
    echo '<div class="k-figures">';
    foreach ($figures as $figure) {
        echo '<div class="k-figure"><span class="k-figure__value">' . esc_html((string) $figure['value']) . '</span><span class="k-figure__label">' . esc_html((string) ($figure['label'] ?? '')) . '</span></div>';
    }
    echo '</div>';
}
echo '</div></div></section>';
