<?php
// The property list block: the plugin's list settings and render function (includes/blocks.php
// there), in the theme's section with its one design option, the background.

declare(strict_types=1);

if (!function_exists('core_client_list_block')) {
    return;
}
echo kowboy_section_open('k-list-section' . (($attributes['background'] ?? 'white') === 'subtle' ? ' k-list-section--subtle' : ''));
echo core_client_list_block($attributes, 'property', ['shadow' => false]); // the theme's stylesheet is on the page
echo '</section>';
