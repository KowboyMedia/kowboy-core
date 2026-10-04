<?php
// The design's sections as WordPress's own blocks (question 103: no bloat): one folder per
// section under blocks/, a block.json naming the fields with Swedish labels and a render.php
// drawing the section on the server. The client plugin's editor script builds every block's
// settings panel from the attributes' `control` keys and previews the section as the server
// renders it (the theme only appends its block names), so a new section is a folder, never more
// editor code. The two list blocks are thin wrappers of the plugin's list settings
// (`coreClientList` in their block.json names which, and the plugin merges its settings into
// theirs as they register): the plugin's one render function, the theme's section around it.
// The plugin must be 0.5.1 or newer before this theme version goes on a site.

declare(strict_types=1);

add_action('init', function (): void {
    $names = [];
    foreach (glob(get_theme_file_path('blocks/*/block.json')) ?: [] as $json) {
        $type = register_block_type(dirname($json));
        if ($type instanceof WP_Block_Type) {
            $names[] = $type->name;
        }
    }
    if (function_exists('core_client_editor_blocks')) {
        core_client_editor_blocks($names);
    }
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
