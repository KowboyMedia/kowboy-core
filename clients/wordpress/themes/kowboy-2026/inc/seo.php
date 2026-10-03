<?php
// The page title and the sharing tags, the way the master site (norbanmakleri.se) carries them:
// `<what the page is about> - <site name>` as the title, and the Open Graph and Twitter tags
// search engines and messengers read when a page is shared. A record's title is its street or
// its name as Core delivers it; the description and the picture are the record's own.

declare(strict_types=1);

add_filter('document_title_separator', fn (): string => '-');
// WordPress's typography turns the hyphen into an en dash; the master writes a plain hyphen.
add_filter('document_title', fn (string $title): string => str_replace(' &#8211; ', ' - ', $title));

add_filter('document_title_parts', function (array $parts): array {
    $title = kowboy_page_title();
    if ($title !== null) {
        $parts['title'] = $title;
    }
    // The front page too reads `<page> - <site>`; WordPress would write the site's name and tagline.
    $parts['site'] = get_bloginfo('name');
    unset($parts['tagline']);
    return $parts;
});

/** What the page is about, or null to keep WordPress's own title. */
function kowboy_page_title(): ?string
{
    if (is_front_page() && is_page()) {
        return get_the_title();
    }
    if (is_singular() && str_starts_with((string) get_post_type(), 'core_')) {
        $item = core_client_item((int) get_the_ID()) ?? [];
        $title = $item['address']['street'] ?? $item['name'] ?? null;
        return is_string($title) && $title !== '' ? $title : null;
    }
    if (is_post_type_archive('core_property')) {
        return 'Till salu';
    }
    if (is_post_type_archive('core_agent')) {
        return 'Våra mäklare';
    }
    return null;
}

/**
 * The description and the picture of the page, for the sharing tags: a listing's selling heading
 * or text and its first photo, an agent's bio and portrait, an area's text and picture, a page's
 * excerpt and the first picture of its hero block.
 *
 * @return array{description: string, image: string}
 */
function kowboy_page_summary(): array
{
    $description = '';
    $image = '';
    if (is_singular() && str_starts_with((string) get_post_type(), 'core_')) {
        $item = core_client_item((int) get_the_ID()) ?? [];
        $description = (string) ($item['short_text'] ?? $item['long_text'] ?? $item['description'] ?? $item['surroundings']['area'] ?? '');
        $images = is_array($item['images'] ?? null) ? $item['images'] : [];
        $photos = array_values(array_filter($images, fn (array $one): bool => ($one['category'] ?? null) !== 'Planritning'));
        $first = $photos[0] ?? (is_array($item['image'] ?? null) ? $item['image'] : null);
        $image = is_array($first) ? (string) ($first['url'] ?? '') : '';
    } elseif (is_singular()) {
        $description = (string) get_the_excerpt();
        foreach (parse_blocks((string) (get_post()?->post_content ?? '')) as $block) {
            if (($block['blockName'] ?? '') === 'kowboy/page-hero') {
                $image = (string) ($block['attrs']['images'][0]['url'] ?? '');
                break;
            }
        }
    }
    return [
        'description' => wp_trim_words(wp_strip_all_tags($description), 30, '…'),
        'image' => $image === '' ? '' : kowboy_image_at($image, 1200),
    ];
}

add_action('wp_head', function (): void {
    if (is_404() || is_search()) {
        return;
    }
    $summary = kowboy_page_summary();
    $url = is_singular() ? (string) get_permalink() : (is_post_type_archive() ? (string) get_post_type_archive_link((string) get_query_var('post_type')) : home_url('/'));
    $tags = [
        ['name', 'description', $summary['description']],
        ['property', 'og:locale', get_locale()],
        ['property', 'og:type', is_front_page() ? 'website' : 'article'],
        ['property', 'og:title', wp_get_document_title()],
        ['property', 'og:description', $summary['description']],
        ['property', 'og:url', $url],
        ['property', 'og:site_name', get_bloginfo('name')],
        ['property', 'og:image', $summary['image']],
        ['name', 'twitter:card', $summary['image'] === '' ? 'summary' : 'summary_large_image'],
    ];
    foreach ($tags as [$attribute, $key, $value]) {
        if ($value !== '') {
            echo '<meta ' . $attribute . '="' . esc_attr($key) . '" content="' . esc_attr($value) . '">' . "\n";
        }
    }
}, 1);
