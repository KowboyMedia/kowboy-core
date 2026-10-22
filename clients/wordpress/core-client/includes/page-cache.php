<?php
// The page cache (Patric, 2026-10-22): the site keeps whole pages with Cache Enabler, and the plugin
// tells it which pages a change made stale, once the change is committed, so no page is kept that a
// running sync is about to change and no page stays stale. WordPress's own events cannot say that
// alone: they fire inside the sync's transaction, and they name only the record written, while a
// record's page also shows the records it names (a home shows its agents, its area and its
// association) and lists the records that name it (an agent's page lists the agent's homes). So a
// change notes the record's page before and after the write (a new status moves a home to a new
// address), and the pages of every record it names or that names it, before and after; and once
// committed, those pages go together with every page that is no single record's (the front page,
// the site's own pages, the archives), which may list or pick any record. A change that reaches
// every page (the plugin's settings, the Customizer, a menu) empties the cache. The lists refresh in
// the browser from the reload endpoint, which no page cache keeps, and an address with a query (a
// list's later page, a filter) is never kept either. Without Cache Enabler on the site, none of this runs.

declare(strict_types=1);

/** The index columns that name another record, and the kind of record each one names. */
const CORE_CLIENT_NAMING_COLUMNS = [
    'agent_ids' => 'agent',
    'office_ids' => 'office',
    'office_id' => 'office',
    'area_id' => 'area',
    'project_id' => 'project',
    'association_id' => 'association',
];

/** Whether the site keeps whole pages: Cache Enabler is active. */
function core_client_page_cache(): bool
{
    return has_action('cache_enabler_clear_page_cache_by_url') !== false;
}

/**
 * The addresses noted as stale and not purged yet. `$add` notes more; `$take` empties the list
 * and answers what it held.
 *
 * @param list<string> $add
 * @return list<string>
 */
function core_client_stale_pages(array $add = [], bool $take = false): array
{
    static $stale = [];
    foreach ($add as $url) {
        $stale[$url] = true;
    }
    if (!$take) {
        return [];
    }
    $taken = array_map('strval', array_keys($stale));
    $stale = [];
    return $taken;
}

/** Note the pages one record's change makes stale, as the site holds the record now: before a write and after it. */
function core_client_note_stale(int $post_id): void
{
    if (!core_client_page_cache()) {
        return;
    }
    $posts = [$post_id, ...core_client_related_posts($post_id)];
    _prime_post_caches($posts, false, false);
    $urls = [];
    foreach ($posts as $id) {
        $url = get_post_status($id) === 'publish' ? get_permalink($id) : false;
        if (is_string($url) && $url !== '') {
            $urls[] = $url;
        }
    }
    core_client_stale_pages($urls);
}

/**
 * The posts whose pages show a record besides its own: the records it names, and the records that
 * name it, by the index's columns and the home-to-area links.
 *
 * @return list<int>
 */
function core_client_related_posts(int $post_id): array
{
    global $wpdb;
    $index = core_client_index_table();
    $links = core_client_links_table();
    $columns = implode(', ', array_keys(CORE_CLIENT_NAMING_COLUMNS));
    $row = $wpdb->get_row($wpdb->prepare("SELECT datatype, remote_id, $columns FROM $index WHERE post_id = %d", $post_id));
    if (!is_object($row)) {
        return [];
    }
    $posts = [];
    $named = $wpdb->get_col($wpdb->prepare("SELECT area_id FROM $links WHERE post_id = %d", $post_id));
    foreach (CORE_CLIENT_NAMING_COLUMNS as $column => $datatype) {
        foreach (array_filter(explode(',', (string) $row->$column)) as $id) {
            $posts[] = core_client_post_id($datatype, $id);
        }
    }
    foreach ($named as $id) {
        $posts[] = core_client_post_id('area', (string) $id);
    }
    $where = [];
    $args = [];
    foreach (array_keys(CORE_CLIENT_NAMING_COLUMNS, $row->datatype, true) as $column) {
        // A list column holds `,id,id,`; the others hold one id.
        $list = str_ends_with($column, '_ids');
        $where[] = $list ? "$column LIKE %s" : "$column = %s";
        $args[] = $list ? '%,' . $wpdb->esc_like((string) $row->remote_id) . ',%' : (string) $row->remote_id;
    }
    if ($where !== []) {
        $posts = array_merge($posts, $wpdb->get_col($wpdb->prepare("SELECT post_id FROM $index WHERE " . implode(' OR ', $where), ...$args)));
    }
    if ($row->datatype === 'area') {
        $posts = array_merge($posts, $wpdb->get_col($wpdb->prepare("SELECT post_id FROM $links WHERE area_id = %s", (string) $row->remote_id)));
    }
    return array_values(array_unique(array_filter(array_map('intval', $posts))));
}

/**
 * Purge what the committed changes made stale, and with it every page that is no single record's:
 * the front page, the site's own pages and each kind's archive with its numbered pages.
 */
function core_client_purge_stale(): void
{
    $urls = core_client_stale_pages([], true);
    if ($urls === [] || !core_client_page_cache()) {
        return;
    }
    global $wp_rewrite;
    $urls[] = home_url('/');
    foreach (get_posts(['post_type' => 'page', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids']) as $page) {
        $urls[] = (string) get_permalink((int) $page);
    }
    foreach (core_client_datatypes() as $datatype) {
        $archive = get_post_type_archive_link(core_client_post_type($datatype));
        if (is_string($archive) && $archive !== '') {
            $urls[] = $archive;
        }
        // Every numbered page under it at once: Cache Enabler reads a trailing `*` as "all below".
        // Without pretty permalinks a numbered page has a query, and no page with one is kept.
        if (is_string($archive) && $archive !== '' && $wp_rewrite->using_permalinks()) {
            $urls[] = trailingslashit($archive) . $wp_rewrite->pagination_base . '/*';
        }
    }
    foreach (array_unique($urls) as $url) {
        do_action('cache_enabler_clear_page_cache_by_url', $url);
    }
}

/** Empty the whole page cache, for a change that reaches every page. */
function core_client_clear_page_cache(): void
{
    if (core_client_page_cache()) {
        do_action('cache_enabler_clear_site_cache');
    }
}

// A record's page as it stands before WordPress writes the post (its old address, its old links);
// after the write, core_item_updated notes it again. The sync's deletions note theirs in
// core_client_delete_item, before the index row goes.
add_action('pre_post_update', function (int $post_id): void {
    if (str_starts_with((string) get_post_type($post_id), 'core_')) {
        core_client_note_stale($post_id);
    }
});
add_action('core_item_updated', function (int $post_id): void {
    core_client_note_stale($post_id);
});

// The sync purges after each committed page (includes/sync.php); whatever else noted a page (the
// site's own records, the rebuild's sweep) is purged when the request ends.
add_action('shutdown', 'core_client_purge_stale');

// The plugin's settings and the forms switch, the Customizer (the theme's options and its CSS) and
// the menus reach every page.
foreach (['added_option', 'updated_option'] as $core_client_option_hook) {
    add_action($core_client_option_hook, function (string $option): void {
        if (str_starts_with($option, 'core_client_')) {
            core_client_clear_page_cache();
        }
    });
}
add_action('customize_save_after', 'core_client_clear_page_cache');
add_action('wp_update_nav_menu', 'core_client_clear_page_cache');
