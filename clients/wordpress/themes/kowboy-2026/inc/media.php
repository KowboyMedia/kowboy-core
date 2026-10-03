<?php
// Images and videos (docs/kowboy-2026.md): one image function for every CRM and site image,
// and the media a hero shows. The srcset follows the widths Kowboy's CDN serves (question 109).

declare(strict_types=1);

/**
 * The widths the CDN serves an image at (Patric, 2026-09-28, question 109: 480 to 3840); a
 * listing's address ends in `_<width>.<ext>`, and 1920 is the largest the sites ask for.
 */
const KOWBOY_IMAGE_WIDTHS = [480, 640, 1024, 1280, 1600, 1920];

/**
 * One `<img>`: lazy and asynchronous unless `$eager` (the first hero image), with a `srcset` over
 * the CDN's widths when the address is a CDN one, and `sizes` for the slot. Width descriptors
 * with `sizes` are how the browser weighs the screen's pixel ratio in: a 384 px slot on a 2x
 * screen picks the 1024 file, on a 1x screen the 480 one (Patric, 2026-09-28).
 *
 * @param array<string, mixed>|string $image a CRM image (`url`, `name`, `description`) or a plain address
 * @param array<string, string> $attributes extra attributes (class, style, width, height)
 */
function kowboy_image(array|string $image, string $sizes, string $alt = '', array $attributes = [], bool $eager = false): string
{
    $url = is_array($image) ? (string) ($image['url'] ?? '') : $image;
    if ($url === '') {
        return '';
    }
    $attributes += [
        'src' => $url,
        'alt' => $alt !== '' ? $alt : (is_array($image) ? (string) ($image['description'] ?? $image['name'] ?? '') : ''),
        'loading' => $eager ? 'eager' : 'lazy',
        'decoding' => $eager ? 'sync' : 'async',
        'sizes' => $sizes,
    ];
    if ($eager) {
        $attributes['fetchpriority'] = 'high';
    }
    $srcset = kowboy_srcset($url);
    if ($srcset !== '') {
        $attributes['srcset'] = $srcset;
    }
    $html = '<img';
    foreach ($attributes as $name => $value) {
        $html .= ' ' . $name . '="' . esc_attr($value) . '"';
    }
    return $html . '>';
}

/** The CDN's widths of one address as a `srcset`, or nothing when the address is not the CDN's or it has one width. */
function kowboy_srcset(string $url): string
{
    if (count(KOWBOY_IMAGE_WIDTHS) < 2 || preg_match('/_(\d+)\.(\w+)$/', $url, $found) !== 1) {
        return '';
    }
    $candidates = [];
    foreach (KOWBOY_IMAGE_WIDTHS as $width) {
        $candidates[] = preg_replace('/_\d+\.(\w+)$/', '_' . $width . '.$1', $url) . ' ' . $width . 'w';
    }
    return implode(', ', $candidates);
}

/** The CDN's file of one address at this width, or the address itself when it is not the CDN's. */
function kowboy_image_at(string $url, int $width): string
{
    return preg_match('/_\d+\.(\w+)$/', $url) === 1 ? (string) preg_replace('/_\d+\.(\w+)$/', '_' . $width . '.$1', $url) : $url;
}

/**
 * Texts as accordion items (parts/accordion.php): a label and a text each, the text as paragraphs.
 *
 * @param array<string, string> $texts label => text
 * @return list<array{label: string, html: string}>
 */
function kowboy_text_items(array $texts): array
{
    return array_map(fn (string $label, string $text): array => ['label' => $label, 'html' => '<div class="k-prose">' . wp_kses_post(wpautop(esc_html($text))) . '</div>'], array_keys($texts), $texts);
}

/** The video id of a Vimeo address, or null when the address is not one. */
function kowboy_vimeo_id(string $url): ?string
{
    return preg_match('#^https?://(?:www\.|player\.)?vimeo\.com/(?:video/)?(\d+)#', trim($url), $found) === 1 ? $found[1] : null;
}

/**
 * The media of a hero, one shape for a listing and for a page: `['type' => 'vimeo', 'id' => …]`,
 * `['type' => 'video', 'src' => …]`, `['type' => 'images', 'images' => [addresses]]` or
 * `['type' => 'none']`. A listing's Vimeo address is one of its links (Patric, question 104).
 *
 * @param list<array<string, mixed>> $links the record's `links[]`
 * @param list<string> $images
 * @return array{type: string, id?: string, src?: string, images?: list<string>}
 */
function kowboy_hero_media(array $links, array $images, string $vimeo_url = '', string $video_src = ''): array
{
    foreach ($links as $link) {
        $id = kowboy_vimeo_id((string) ($link['url'] ?? ''));
        if ($id !== null) {
            return ['type' => 'vimeo', 'id' => $id];
        }
    }
    $id = kowboy_vimeo_id($vimeo_url);
    if ($id !== null) {
        return ['type' => 'vimeo', 'id' => $id];
    }
    if ($video_src !== '') {
        return ['type' => 'video', 'src' => $video_src];
    }
    $images = array_values(array_filter($images, fn (string $url): bool => $url !== ''));
    return $images === [] ? ['type' => 'none'] : ['type' => 'images', 'images' => $images];
}

/** Render one of the theme's parts (parts/<name>.php) with these variables and hand back the HTML. */
function kowboy_part(string $name, array $vars = []): string
{
    $render = static function (string $kowboy_part_path, array $kowboy_part_vars): string {
        extract($kowboy_part_vars, EXTR_SKIP);
        ob_start();
        include $kowboy_part_path;
        return (string) ob_get_clean();
    };
    return $render(get_theme_file_path('parts/' . $name . '.php'), $vars);
}
