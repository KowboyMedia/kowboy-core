<?php
// Routing by id (SRS Appendix A; Patric, 2026-09-19, questions 41 and 42): a request under a
// kind's path that names no post, such as /objekt/<id> or /objekt/<old slug>-<id>, answers 301
// to the record's current permalink, and 301 to the kind's archive when no record has that id
// (a removed listing, or a mistyped one). Every kind, since every slug ends in the id
// (question 101). "Objekt" is Swedish for a property listing.

declare(strict_types=1);

// A kind of record the site does not publish (the settings page) answers 404, page and archive alike.
add_action('template_redirect', function (): void {
    $type = is_singular() || is_post_type_archive() ? (string) (is_singular() ? get_post_type() : get_query_var('post_type')) : '';
    if (str_starts_with($type, 'core_') && !core_client_published(substr($type, 5))) {
        global $wp_query;
        $wp_query->set_404();
        status_header(404);
        nocache_headers();
    }
}, 5);

add_action('template_redirect', function (): void {
    if (!is_404()) {
        return;
    }
    foreach (core_client_datatypes() as $datatype) {
        $name = (string) get_query_var(core_client_post_type($datatype));
        if ($name === '') {
            continue;
        }
        // An unpublished kind stays 404 (the hook above), or the page would redirect to itself.
        if (!core_client_published($datatype)) {
            return;
        }
        $post_id = core_client_post_id_by_slug($datatype, $name);
        $target = $post_id === null
            ? get_post_type_archive_link(core_client_post_type($datatype))
            : get_permalink($post_id);
        if (is_string($target) && $target !== '') {
            wp_safe_redirect($target, 301);
            exit;
        }
        return;
    }
});

/** The post of the record whose id the name is, or ends with after a dash; null when none. */
function core_client_post_id_by_slug(string $datatype, string $name): ?int
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
            "SELECT post_id FROM $index WHERE datatype = %s AND remote_id = %s",
            $datatype,
            $candidate,
        ));
        if ($post_id !== null) {
            return (int) $post_id;
        }
    }
    return null;
}
