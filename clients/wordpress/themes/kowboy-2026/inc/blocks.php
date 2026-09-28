<?php
// The design's sections as WordPress's own blocks (question 103: no bloat): one folder per
// section under blocks/, a block.json naming the fields with Swedish labels and a render.php
// drawing the section on the server. One editor script (assets/editor.js) builds every block's
// settings panel from the attributes' `control` keys and previews the section as the server
// renders it, so a new section is a folder, never more editor code.

declare(strict_types=1);

add_action('init', function (): void {
    wp_register_script(
        'kowboy-2026-editor',
        get_theme_file_uri('assets/editor.js'),
        ['wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-server-side-render', 'wp-i18n'],
        KOWBOY_2026_VERSION,
        true,
    );
    $names = [];
    foreach (glob(get_theme_file_path('blocks/*/block.json')) ?: [] as $json) {
        $type = register_block_type(dirname($json));
        if ($type instanceof WP_Block_Type) {
            $names[] = $type->name;
        }
    }
    wp_add_inline_script('kowboy-2026-editor', 'window.kowboyBlocks = ' . wp_json_encode($names) . ';', 'before');
});

add_filter('block_categories_all', function (array $categories): array {
    array_unshift($categories, ['slug' => 'kowboy', 'title' => 'Kowboy 2026']);
    return $categories;
});

/** The block's wrapper attributes plus the section class, one call in every render.php. */
function kowboy_section_open(string $class, array $extra = []): string
{
    return '<section ' . get_block_wrapper_attributes(['class' => 'k-section ' . $class] + $extra) . '>';
}
