<?php
// The page hero: the same hero part as a property page, with the page's own texts and buttons,
// and the search form when the page asks for it.

declare(strict_types=1);

$images = array_map(fn (array $image): string => (string) ($image['url'] ?? ''), is_array($attributes['images'] ?? null) ? $attributes['images'] : []);
$media = match ((string) ($attributes['mediaType'] ?? 'images')) {
    'vimeo' => kowboy_hero_media([], [], (string) ($attributes['vimeoUrl'] ?? '')),
    'video' => kowboy_hero_media([], [], '', (string) ($attributes['video']['url'] ?? '')),
    default => kowboy_hero_media([], $images),
};
$buttons = '';
foreach (is_array($attributes['buttons'] ?? null) ? $attributes['buttons'] : [] as $button) {
    if (($button['label'] ?? '') !== '') {
        $buttons .= '<a class="k-button k-button--light" href="' . esc_url((string) ($button['url'] ?? '#')) . '">' . esc_html((string) $button['label']) . '</a>';
    }
}
$content = '<div class="k-hero__text">';
if (($attributes['title'] ?? '') !== '') {
    $content .= '<h1 class="k-hero__title">' . esc_html((string) $attributes['title']) . '</h1>';
}
if (($attributes['lead'] ?? '') !== '') {
    $content .= '<p class="k-hero__lead">' . esc_html((string) $attributes['lead']) . '</p>';
}
if ($buttons !== '') {
    $content .= '<div class="k-hero__buttons">' . $buttons . '</div>';
}
$content .= '</div>';
if (!empty($attributes['searchForm'])) {
    $content .= kowboy_part('search-form', []);
}
echo kowboy_part('hero', [
    'media' => $media,
    'content' => $content,
    'variant' => ($attributes['height'] ?? 'default') === 'tall' ? 'page k-hero--tall' : 'page',
    'wrapper' => get_block_wrapper_attributes(['class' => 'k-hero k-hero--page' . (($attributes['height'] ?? '') === 'tall' ? ' k-hero--tall' : '') . (!empty($attributes['searchForm']) ? ' k-hero--with-form' : '')]),
]);
