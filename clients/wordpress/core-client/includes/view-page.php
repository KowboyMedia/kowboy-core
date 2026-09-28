<?php
// The page around one view: the theme's header and footer with the view between them, wrapped in
// a shadow root when the site asked for one. Which view: set by the routing in templates.php. A
// single page gets its post id and the item as the local copy holds it; an archive gets nothing
// and calls the list function itself.

declare(strict_types=1);

$core_client_view = (string) ($GLOBALS['core_client_view'] ?? '');
$core_client_vars = [];
if (is_singular()) {
    $core_client_post_id = (int) get_the_ID();
    $core_client_vars = [
        'post_id' => $core_client_post_id,
        'item' => core_client_item($core_client_post_id) ?? [],
        'raw' => core_client_item_raw($core_client_post_id) ?? [],
    ];
}

get_header();
echo core_client_wrap(core_client_render($core_client_view, $core_client_vars));
get_footer();
