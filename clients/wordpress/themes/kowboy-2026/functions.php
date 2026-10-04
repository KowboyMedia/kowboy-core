<?php
// The theme "Kowboy 2026": the set 2026 of Kowboy Core (docs/kowboy-2026.md). It registers
// itself as the client plugin's template set (the views under core/), adds the design's sections
// as blocks (blocks/), the theme options (inc/options.php), the demo pages (inc/pages.php) and
// the page titles and sharing tags (inc/seo.php).
// One stylesheet and one script, on the page and in the roots.

declare(strict_types=1);

const KOWBOY_2026_VERSION = '1.1.1';

require __DIR__ . '/inc/media.php';
require __DIR__ . '/inc/association.php';
require __DIR__ . '/inc/options.php';
require __DIR__ . '/inc/blocks.php';
require __DIR__ . '/inc/pages.php';
require __DIR__ . '/inc/seo.php';

if (function_exists('core_client_register_template_set')) {
    core_client_register_template_set('kowboy-2026', 'Kowboy 2026', __FILE__, KOWBOY_2026_VERSION);
}

/** Cards a page on the areas and associations archives (parts/paging.php carries the page numbers). */
const KOWBOY_ARCHIVE_PER_PAGE = 24;

// The archives page by WordPress's own /page/N/, so its main query must count the same pages as the list.
add_action('pre_get_posts', function (WP_Query $query): void {
    if ($query->is_main_query() && !is_admin() && $query->is_post_type_archive(['core_area', 'core_association'])) {
        $query->set('posts_per_page', KOWBOY_ARCHIVE_PER_PAGE);
    }
});

add_action('after_setup_theme', function (): void {
    add_theme_support('title-tag');
    add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script']);
    add_theme_support('editor-styles');
    add_editor_style('assets/kowboy-2026.css');
    register_nav_menus(['primary' => 'Huvudmeny', 'footer' => 'Sidfotsmeny']);
});

/** The address of one of the theme's files, with the theme's version. */
function kowboy_asset(string $relative): string
{
    // The file's own time as the version, so a browser and the page cache fetch every change
    // (the set's version alone stayed the same across deploys and left the old file in place).
    $path = get_theme_file_path($relative);
    $time = is_file($path) ? (string) filemtime($path) : KOWBOY_2026_VERSION;
    return add_query_arg('ver', KOWBOY_2026_VERSION . '.' . $time, get_theme_file_uri($relative));
}

/**
 * The stylesheet and the script, under the handles the client plugin uses for the set, so
 * WordPress prints each once whichever of the two asks first.
 */
add_action('wp_enqueue_scripts', function (): void {
    wp_enqueue_style('core-client-vendor', kowboy_asset('assets/vendor/kowboy-2026-vendor.css'), [], null);
    wp_enqueue_style('core-client-set', kowboy_asset('assets/kowboy-2026.css'), ['core-client-vendor'], null);
    wp_enqueue_script('core-client-vendor', kowboy_asset('assets/vendor/kowboy-2026-vendor.js'), [], null, ['in_footer' => true]);
    wp_enqueue_script('core-client-set', kowboy_asset('assets/kowboy-2026.js'), ['core-client-vendor'], null, ['in_footer' => true]);
    wp_add_inline_style('core-client-set', kowboy_typography_css());
}, 5);

/** Whether the page opens with a hero the header lies over: a property's or an area's page, or a page whose first block is the hero. */
function kowboy_has_hero(): bool
{
    if (is_singular(['core_property', 'core_area'])) {
        return true;
    }
    if (is_singular() && is_string(get_post()?->post_content)) {
        $blocks = parse_blocks((string) get_post()->post_content);
        $first = array_values(array_filter($blocks, fn (array $block): bool => $block['blockName'] !== null))[0] ?? null;
        return ($first['blockName'] ?? '') === 'kowboy/page-hero';
    }
    return false;
}

add_filter('body_class', function (array $classes): array {
    $classes[] = kowboy_has_hero() ? 'k-has-hero' : 'k-no-hero';
    return $classes;
});
