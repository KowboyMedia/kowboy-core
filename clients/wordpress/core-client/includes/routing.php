<?php
// Routing by id (SRS Appendix A; Patric, 2026-09-19, questions 41 and 42): a request under the
// property path that names no post, such as /objekt/<id> or /objekt/<old slug>-<id>, answers 301
// to the property's current permalink, and 301 to the property archive when no property has that
// id (a removed listing, or a mistyped one). "Objekt" is Swedish for a property listing.

declare(strict_types=1);

add_action('template_redirect', function (): void {
    if (!is_404()) {
        return;
    }
    $name = (string) get_query_var('core_property');
    if ($name === '') {
        return;
    }
    $post_id = core_client_property_post_id($name);
    $target = $post_id === null
        ? get_post_type_archive_link(core_client_post_type('property'))
        : get_permalink($post_id);
    if (is_string($target) && $target !== '') {
        wp_safe_redirect($target, 301);
        exit;
    }
});

/** The post of the property whose id the name is, or ends with after a dash; null when none. */
function core_client_property_post_id(string $name): ?int
{
    global $wpdb;
    $index = core_client_index_table();
    $candidates = [$name];
    $offset = 0;
    while (($dash = strpos($name, '-', $offset)) !== false) {
        $candidates[] = substr($name, $dash + 1);
        $offset = $dash + 1;
    }
    foreach ($candidates as $candidate) {
        $post_id = $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM $index WHERE datatype = 'property' AND remote_id = %s",
            $candidate,
        ));
        if ($post_id !== null) {
            return (int) $post_id;
        }
    }
    return null;
}
