<?php
// The local copy (SRS Appendix A): one post type per datatype carries each item, the full `data`
// sits in one JSON meta key, the raw CRM payload in another, and one index table answers "which
// post holds this item", the hash test, and the list queries (includes/query.php) from search
// columns copied off the universal names. Templates read from here and never from Core.

declare(strict_types=1);

/**
 * Reference order (SRS §6.9): offices, agents and projects before the properties that point at them.
 *
 * @return list<string>
 */
function core_client_datatypes(): array
{
    return ['office', 'agent', 'area', 'association', 'project', 'property'];
}

function core_client_post_type(string $datatype): string
{
    return 'core_' . $datatype;
}

/** The path a datatype's pages live under (Patric, 2026-09-18 and 2026-09-19, questions 45 and 49). */
function core_client_path(string $datatype): string
{
    return ['property' => 'objekt', 'office' => 'kontor', 'project' => 'projekt', 'association' => 'forening', 'agent' => 'maklare', 'area' => 'omrade'][$datatype] ?? $datatype;
}

/**
 * The post's slug, from the record's own stored values and ending in the record's id, the way
 * norbanmakleri.se names its pages (Patric, 2026-10-03, closes question 101): property and project
 * `<status>-<city>-<area>-<street>-<id>`, area `<kommun>-<name>-<id>` (the kommun from its LKF code,
 * municipalities.php), every other kind `<name>-<id>`. The status word is the
 * list the site's settings put the status in (`till-salu`, `kommande`, `sold`: the old site's
 * words), else the CRM's own status name. An empty part is left out, and the id is always last, so
 * routing.php finds the record by it whatever the words were when a link was made. Every part goes
 * through WordPress's own slug rule (`sanitize_title`): letters with accents become their base
 * letters (é to e, ä to a), apostrophes, parentheses and other marks are dropped (Patric,
 * 2026-10-04), and the words are cut so that the whole slug fits the post's 200 characters with the
 * id intact.
 */
function core_client_slug(string $datatype, object $data, string $remote_id): string
{
    $address = is_object($data->address ?? null) ? $data->address : new stdClass();
    $parts = match ($datatype) {
        'property', 'project' => [
            core_client_slug_status($data->status ?? null),
            $address->city ?? null,
            $address->area_name ?? null,
            ($address->street ?? null) ?: ($data->name ?? null),
        ],
        'area' => [core_client_municipality_name(is_string($data->county_municipality_code ?? null) ? $data->county_municipality_code : null), $data->name ?? null],
        default => [$data->name ?? null],
    };
    $words = implode('-', array_filter(array_map(fn (mixed $part): string => is_string($part) ? sanitize_title($part) : '', $parts)));
    $id = sanitize_title($remote_id);
    $room = 200 - strlen($id) - 1;
    if (strlen($words) > $room) {
        $words = rtrim(substr($words, 0, $room), '-');
    }
    return $words === '' ? $id : $words . '-' . $id;
}

/** The slug's word for a status: the site's list it is in, else the CRM's name for it; null without a status. */
function core_client_slug_status(mixed $status): ?string
{
    $id = is_object($status) && is_string($status->id ?? null) ? $status->id : null;
    if ($id === null) {
        return null;
    }
    $lists = core_client_statuses();
    foreach (['for_sale' => 'till-salu', 'coming' => 'kommande', 'sold' => 'sold'] as $list => $word) {
        if (in_array($id, $lists[$list], true)) {
            return $word;
        }
    }
    return is_string($status->name ?? null) && $status->name !== '' ? $status->name : $id;
}

function core_client_index_table(): string
{
    global $wpdb;
    return $wpdb->prefix . 'core_index';
}

function core_client_state_table(): string
{
    global $wpdb;
    return $wpdb->prefix . 'core_sync_state';
}

/** The admin's name for a datatype (the menu, the list tables). */
function core_client_datatype_label(string $datatype): string
{
    return ['property' => 'Properties', 'office' => 'Offices', 'project' => 'Projects', 'association' => 'Associations', 'agent' => 'Agents', 'area' => 'Areas'][$datatype] ?? ucfirst($datatype);
}

/**
 * Whether the site publishes a datatype (the settings page, Patric 2026-10-03): off, its pages
 * answer 404, its archive is gone and every list of it is empty, while the local copy stays.
 */
function core_client_published(string $datatype): bool
{
    return (string) get_option("core_client_publish_$datatype", '1') !== '0';
}

/** The connection of the records the site types itself (includes/site-records.php); never a CRM's. */
function core_client_site_connection(): string
{
    return 'site';
}

/** The kinds of record a site may add itself: agents and offices (Patric, 2026-10-03, question 125). */
function core_client_site_datatype(string $datatype): bool
{
    return $datatype === 'agent' || $datatype === 'office';
}

/**
 * The connection a post's record came from: a CRM's, the site's own, or null for a post without a
 * row (one being added). Only a CRM's answer is remembered: a no can turn into a yes within the
 * request (the sync writing a new post's row).
 */
function core_client_connection_of(int $post_id): ?string
{
    static $crm = [];
    if (isset($crm[$post_id])) {
        return $crm[$post_id];
    }
    global $wpdb;
    $connection = $wpdb->get_var($wpdb->prepare('SELECT connection_id FROM ' . core_client_index_table() . ' WHERE post_id = %d', $post_id));
    if (!is_string($connection)) {
        return null;
    }
    if ($connection !== core_client_site_connection()) {
        $crm[$post_id] = $connection;
    }
    return $connection;
}

/** Whether a post is a CRM record: its row came from a connection other than the site's own. */
function core_client_is_crm_post(int $post_id): bool
{
    $connection = core_client_connection_of($post_id);
    return $connection !== null && $connection !== core_client_site_connection();
}

/**
 * Whether the sync is writing a post right now, so the hook that turns a post into one of the
 * site's own records (includes/site-records.php) leaves the sync's inserts alone.
 */
function core_client_sync_writing(?bool $set = null): bool
{
    static $writing = false;
    if ($set !== null) {
        $writing = $set;
    }
    return $writing;
}

/**
 * One post type per datatype, under its Swedish path, listed under the Kowboy Estates menu. A
 * CRM record is the sync's: the admin can open and look (the page, the record's data), never add,
 * edit or delete one (Patric, 2026-10-03). Agents and offices are also the site's to add itself
 * (question 125, includes/site-records.php): those two types take new posts, with the featured
 * image as the portrait, and the filter below keeps every CRM post of theirs locked one by one.
 * Called on `init`, and by the activation hook before it flushes the rewrite rules.
 */
function core_client_register_post_types(): void
{
    foreach (core_client_datatypes() as $datatype) {
        $own = core_client_site_datatype($datatype);
        // An unpublished datatype keeps its routes (routing.php answers 404 for them, so the request
        // never falls through to the home page) and leaves the search.
        register_post_type(core_client_post_type($datatype), [
            'label' => core_client_datatype_label($datatype),
            'labels' => ['name' => core_client_datatype_label($datatype), 'singular_name' => ucfirst($datatype)],
            'public' => true,
            'has_archive' => true,
            'exclude_from_search' => !core_client_published($datatype),
            'show_ui' => true,
            'show_in_menu' => 'core-client',
            'rewrite' => ['slug' => core_client_path($datatype)],
            'supports' => $datatype === 'agent' ? ['title', 'thumbnail'] : ['title'],
            'show_in_rest' => false,
            'map_meta_cap' => true,
            // The site's own records: editors and administrators (the page capabilities), per post
            // through the filter below; a CRM record: nobody.
            'capability_type' => $own ? 'page' : 'post',
            'capabilities' => $own ? [] : [
                'create_posts' => 'do_not_allow',
                'edit_post' => 'do_not_allow',
                'delete_post' => 'do_not_allow',
                'delete_posts' => 'do_not_allow',
                'publish_posts' => 'do_not_allow',
            ],
        ]);
    }
}

// WordPress maps `edit_post` and `delete_post` by their literal names, past the type's own caps, so the
// records' read-only state is enforced here: no one edits or deletes a synced record from the admin.
add_filter('map_meta_cap', function (array $caps, string $cap, int $user_id, array $args): array {
    if (!in_array($cap, ['edit_post', 'delete_post', 'publish_post'], true) || !isset($args[0])) {
        return $caps;
    }
    $type = get_post_type((int) $args[0]);
    if (!is_string($type) || !str_starts_with($type, 'core_')) {
        return $caps;
    }
    // A CRM record is locked for everyone; a post of a kind the site adds itself is the site's own.
    return core_client_site_datatype(substr($type, 5)) && !core_client_is_crm_post((int) $args[0]) ? $caps : ['do_not_allow'];
}, 10, 4);

/** A post deleted from the admin (the site's own records) takes its index row with it; the sync's own deletes did already. */
add_action('deleted_post', function (int $post_id, WP_Post $post): void {
    if (str_starts_with($post->post_type, 'core_')) {
        global $wpdb;
        $wpdb->delete(core_client_index_table(), ['post_id' => $post_id]);
        $wpdb->delete(core_client_links_table(), ['post_id' => $post_id]);
    }
}, 10, 2);

add_action('admin_init', function (): void {
    foreach (core_client_datatypes() as $datatype) {
        add_filter('bulk_actions-edit-' . core_client_post_type($datatype), '__return_empty_array');
    }
});

/**
 * The list tables' row actions: the page and the record's data (`?debugpl`) for every record, and
 * for a CRM record nothing that writes; the site's own records keep WordPress's edit and trash.
 */
add_filter('post_row_actions', function (array $actions, WP_Post $post): array {
    if (!str_starts_with($post->post_type, 'core_')) {
        return $actions;
    }
    $link = (string) get_permalink($post);
    $look = [
        'view' => '<a href="' . esc_url($link) . '">View</a>',
        'data' => '<a href="' . esc_url(add_query_arg('debugpl', '', $link)) . '">Data</a>',
    ];
    return core_client_is_crm_post($post->ID) ? $look : $actions + $look;
}, 10, 2);

add_action('init', function (): void {
    core_client_register_post_types();
});

/** Create or update the plugin's tables. Runs on activation and after a plugin update. */
function core_client_install(): void
{
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $charset = $wpdb->get_charset_collate();
    $index = core_client_index_table();
    $state = core_client_state_table();
    $links = core_client_links_table();
    // The search columns are copies of universal names (docs/field-tables.md), filled on every
    // write, so a list query never opens the JSON. `agent_ids` is `,id,id,` for one LIKE. The
    // code, the point and an area's outline bounds serve the search by place (docs/search.md).
    dbDelta("CREATE TABLE $index (
        post_id bigint(20) unsigned NOT NULL,
        datatype varchar(20) NOT NULL,
        connection_id varchar(191) NOT NULL,
        remote_id varchar(191) NOT NULL,
        office_id varchar(191) DEFAULT NULL,
        seq bigint(20) NOT NULL,
        content_hash varchar(64) NOT NULL,
        remote_updated_at datetime DEFAULT NULL,
        synced_at datetime(6) NOT NULL,
        status_id varchar(64) DEFAULT NULL,
        type_id varchar(64) DEFAULT NULL,
        tenure_id varchar(64) DEFAULT NULL,
        price decimal(14,2) DEFAULT NULL,
        living_space decimal(10,2) DEFAULT NULL,
        rooms decimal(6,2) DEFAULT NULL,
        area_name varchar(191) DEFAULT NULL,
        city varchar(191) DEFAULT NULL,
        street varchar(191) DEFAULT NULL,
        project_id varchar(191) DEFAULT NULL,
        agent_ids text DEFAULT NULL,
        published_at datetime DEFAULT NULL,
        sold_at datetime DEFAULT NULL,
        sort_name varchar(191) DEFAULT NULL,
        sort_order int DEFAULT NULL,
        office_ids text DEFAULT NULL,
        area_id varchar(191) DEFAULT NULL,
        listed tinyint(1) NOT NULL DEFAULT 1,
        association_id varchar(191) DEFAULT NULL,
        county_municipality_code varchar(6) DEFAULT NULL,
        lat decimal(10,7) DEFAULT NULL,
        lng decimal(10,7) DEFAULT NULL,
        min_lat decimal(10,7) DEFAULT NULL,
        max_lat decimal(10,7) DEFAULT NULL,
        min_lng decimal(10,7) DEFAULT NULL,
        max_lng decimal(10,7) DEFAULT NULL,
        polygon_hash varchar(32) DEFAULT NULL,
        PRIMARY KEY  (post_id),
        UNIQUE KEY item (datatype, connection_id, remote_id),
        KEY listing (datatype, status_id, published_at),
        KEY project (project_id),
        KEY place (datatype, county_municipality_code)
    ) $charset;");
    // Which areas a home is in (includes/areas.php): the CRM's and every outline that holds its point.
    dbDelta("CREATE TABLE $links (
        post_id bigint(20) unsigned NOT NULL,
        area_id varchar(191) NOT NULL,
        PRIMARY KEY  (post_id, area_id),
        KEY area (area_id)
    ) $charset;");
    dbDelta("CREATE TABLE $state (
        name varchar(64) NOT NULL,
        value text NOT NULL,
        PRIMARY KEY  (name)
    ) $charset;");
    update_option('core_client_db_version', CORE_CLIENT_VERSION);
}

register_activation_hook(CORE_CLIENT_FILE, function (): void {
    core_client_install();
    core_client_place_updater();
    // The activation request is past `init`, so the post types are registered here before the
    // rewrite rules are rebuilt; otherwise every record page answers 404 until the permalinks are saved.
    core_client_register_post_types();
    flush_rewrite_rules();
});

add_action('plugins_loaded', function (): void {
    if (get_option('core_client_db_version') !== CORE_CLIENT_VERSION) {
        core_client_install();
        // The search columns are copied anew from every post's data, so a column this version adds is
        // filled, and every slug is rebuilt: at `init`, once the post types and the rewrite rules exist.
        add_action('init', 'core_client_reindex', 15);
        // An update arrives without the activation hook: rebuild the rewrite rules once the post types are registered.
        add_action('init', 'flush_rewrite_rules', 20);
    }
});

/**
 * Every index row written again from its post's data: the search columns as this version copies
 * them, and the post's slug as this version builds it. Run once on an update; the sync keeps them
 * current from then on.
 */
function core_client_reindex(): void
{
    global $wpdb;
    $index = core_client_index_table();
    foreach ($wpdb->get_results("SELECT * FROM $index") ?: [] as $row) {
        $data = json_decode((string) get_post_meta((int) $row->post_id, 'core_data', true));
        $slug = core_client_slug((string) $row->datatype, is_object($data) ? $data : new stdClass(), (string) $row->remote_id);
        if (get_post_field('post_name', (int) $row->post_id) !== $slug) {
            wp_update_post(['ID' => (int) $row->post_id, 'post_name' => $slug]);
            clean_post_cache((int) $row->post_id);
        }
        $columns = (array) $row;
        unset($columns['synced_at']);
        $columns = array_map(fn (mixed $value): mixed => is_numeric($value) && !is_string($value) ? $value : $value, $columns);
        core_client_replace_index_row([...$columns, 'synced_at' => 'now', ...core_client_search_columns(is_object($data) ? $data : new stdClass())]);
    }
    // The links from homes to areas, in the background (includes/areas.php): the areas' bounds above are what it reads.
    as_enqueue_async_action(CORE_CLIENT_LINK_REBUILD, ['offset' => 0], 'core-client');
}

/**
 * The index row for one item, only while its post still exists: a post deleted behind the
 * plugin's back is treated as missing, so the next sync puts it back.
 */
function core_client_index_row(string $datatype, string $connection_id, string $remote_id): ?object
{
    global $wpdb;
    $index = core_client_index_table();
    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT i.* FROM $index i JOIN {$wpdb->posts} p ON p.ID = i.post_id
         WHERE i.datatype = %s AND i.connection_id = %s AND i.remote_id = %s",
        $datatype,
        $connection_id,
        $remote_id,
    ));
    return is_object($row) ? $row : null;
}

/**
 * Write one item from a /v1/changes page into its post and the index. Returns the post id.
 *
 * The post goes through wp_insert_post and wp_update_post, so WordPress fires what cache plugins
 * listen for (save_post, transition_post_status, clean_post_cache), and core_item_updated says
 * which item it was.
 */
function core_client_upsert_item(string $datatype, object $item, ?object $existing): int
{
    global $wpdb;

    // WordPress keeps the post's dates itself (question 43, Patric 2026-09-19): the modified time
    // moves with every write, and a write happens only when the content changed, so the sitemap's
    // change date is right without a line of code. The CRM's own change time is in the index and
    // in the JSON, for the templates.
    $remote = is_string($item->remote_updated_at) ? strtotime($item->remote_updated_at) : false;

    $post = [
        'post_type' => core_client_post_type($datatype),
        'post_status' => 'publish',
        'post_title' => (string) ($item->data->id ?? $item->remote_id),
        'post_name' => core_client_slug($datatype, is_object($item->data) ? $item->data : new stdClass(), $item->remote_id),
    ];
    if ($existing !== null) {
        $post['ID'] = (int) $existing->post_id;
    }
    core_client_sync_writing(true);
    try {
        $post_id = $existing !== null ? wp_update_post($post, true) : wp_insert_post($post, true);
    } finally {
        core_client_sync_writing(false);
    }
    if (is_wp_error($post_id)) {
        throw new RuntimeException($post_id->get_error_message());
    }
    core_client_store_record(
        $post_id,
        $datatype,
        (string) wp_json_encode($item->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        // The CRM payload exactly as Core served it, next to the data (Patric, 2026-09-18).
        (string) wp_json_encode($item->raw ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        [
            'connection_id' => $item->connection_id,
            'remote_id' => $item->remote_id,
            'office_id' => $item->office_id,
            'seq' => $item->seq,
            'content_hash' => $item->content_hash,
            'remote_updated_at' => $remote === false ? null : gmdate('Y-m-d H:i:s', $remote),
        ],
    );
    return $post_id;
}

/**
 * The one write of a record next to its post, from the sync and from the site's own records
 * alike: the data and the raw payload as meta, the index row with the search columns, and the
 * word to cache plugins. `synced_at` is bookkeeping for the rebuild sweep only; nothing else may
 * key on it.
 *
 * @param array<string, mixed> $row the row's own columns: connection, remote id, office, seq, hash, remote time
 */
function core_client_store_record(int $post_id, string $datatype, string $json, string $raw_json, array $row): void
{
    global $wpdb;
    update_post_meta($post_id, 'core_data', wp_slash($json));
    update_post_meta($post_id, 'core_raw', wp_slash($raw_json));
    $data = json_decode($json);
    $data = is_object($data) ? $data : new stdClass();
    // What the home-to-area links depend on, as the row held it before this write (includes/areas.php).
    $before = $wpdb->get_row($wpdb->prepare('SELECT lat, lng, area_id, polygon_hash FROM ' . core_client_index_table() . ' WHERE post_id = %d', $post_id));
    core_client_replace_index_row([
        'post_id' => $post_id,
        'datatype' => $datatype,
        ...$row,
        'synced_at' => 'now',
        ...core_client_search_columns($data),
    ]);
    core_client_link_record($post_id, $datatype, $data, is_object($before) ? $before : null);
    clean_post_cache($post_id);
    do_action('core_item_updated', $post_id, $datatype);
}

/**
 * REPLACE one index row: a missing value is written as NULL (wpdb::prepare has no placeholder for
 * it), and `synced_at` by the database's own clock, the one the rebuild sweep compares against.
 *
 * @param array<string, string|int|float|null> $row
 */
function core_client_replace_index_row(array $row): void
{
    global $wpdb;
    $columns = [];
    $places = [];
    $args = [];
    foreach ($row as $column => $value) {
        $columns[] = $column;
        if ($value === null) {
            $places[] = 'NULL';
        } elseif ($column === 'synced_at') {
            $places[] = 'NOW(6)';
        } elseif (is_int($value)) {
            $places[] = '%d';
            $args[] = $value;
        } elseif (is_float($value)) {
            $places[] = '%f';
            $args[] = $value;
        } else {
            $places[] = '%s';
            $args[] = $value;
        }
    }
    $sql = 'REPLACE INTO ' . core_client_index_table() . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $places) . ')';
    $wpdb->query($wpdb->prepare($sql, ...$args));
}

/**
 * The search columns, copied from the universal names of `data` as they are, null where the
 * record has no value. Nothing is judged: a status id is stored, a price is stored.
 *
 * @return array<string, string|int|float|null>
 */
function core_client_search_columns(object $data): array
{
    $id = fn (mixed $named): ?string => is_object($named) && is_string($named->id ?? null) ? $named->id : null;
    $number = fn (mixed $value): ?float => is_int($value) || is_float($value) ? (float) $value : null;
    $text = fn (mixed $value): ?string => is_string($value) && $value !== '' ? mb_substr($value, 0, 191) : null;
    $moment = function (mixed $value): ?string {
        $time = is_string($value) ? strtotime($value) : false;
        return $time === false ? null : gmdate('Y-m-d H:i:s', $time);
    };
    $ids = fn (mixed $list): ?string => is_array($list) && $list !== [] ? ',' . implode(',', array_filter($list, 'is_string')) . ',' : null;
    $order = function (mixed $offices): ?int {
        $orders = [];
        foreach (is_array($offices) ? $offices : [] as $office) {
            if (is_object($office) && (is_int($office->order ?? null) || is_float($office->order ?? null))) {
                $orders[] = (int) $office->order;
            }
        }
        return $orders === [] ? null : min($orders);
    };
    // The site's rule (Patric, 2026-10-03): an agent whose CRM record says "not in the staff list", on the
    // record or on any of its offices, stays out of every list; a page that names the agent (a home's card) shows them.
    $listed = function (object $data): int {
        if (($data->is_visible_in_staff_list ?? null) === false) {
            return 0;
        }
        foreach (is_array($data->offices ?? null) ? $data->offices : [] as $office) {
            if (is_object($office) && ($office->is_visible_in_staff_list ?? null) === false) {
                return 0;
            }
        }
        return 1;
    };
    $address = is_object($data->address ?? null) ? $data->address : new stdClass();
    $bounds = core_client_polygon_bounds($data->polygon ?? null);
    return [
        'status_id' => $id($data->status ?? null),
        'type_id' => $id($data->type ?? null),
        'tenure_id' => $id($data->tenure ?? null),
        'price' => $number($data->price ?? null),
        'living_space' => $number($data->living_space ?? null),
        'rooms' => $number($data->rooms ?? null),
        'area_name' => $text($address->area_name ?? null),
        'city' => $text($address->city ?? null),
        'street' => $text($address->street ?? null),
        'project_id' => $text($data->project_id ?? null),
        'agent_ids' => $ids($data->agent_ids ?? null),
        'published_at' => $moment($data->published_at ?? null),
        'sold_at' => $moment($data->sold_at ?? null),
        'sort_name' => $text($data->name ?? null) ?? $text($address->street ?? null),
        // An agent's place in the CRM's staff list: the smallest `order` over the offices (Patric, 2026-10-03).
        'sort_order' => $order($data->offices ?? null),
        'office_ids' => $ids($data->office_ids ?? null),
        'area_id' => $text($address->area_id ?? null),
        'listed' => $listed($data),
        'association_id' => $text($data->association_id ?? null),
        // The place: a home's code sits under its address, an area's on the record; the point as sent.
        'county_municipality_code' => $text($address->county_municipality_code ?? $data->county_municipality_code ?? null),
        'lat' => $number($data->lat ?? null),
        'lng' => $number($data->lng ?? null),
        // An area's outline, as its bounds and a hash to compare against (includes/areas.php).
        'min_lat' => $bounds['min_lat'] ?? null,
        'max_lat' => $bounds['max_lat'] ?? null,
        'min_lng' => $bounds['min_lng'] ?? null,
        'max_lng' => $bounds['max_lng'] ?? null,
        'polygon_hash' => core_client_polygon_hash($data->polygon ?? null),
    ];
}

/** A tombstone: the post and its index row go, through wp_delete_post (deleted_post fires). */
function core_client_delete_item(string $datatype, string $connection_id, string $remote_id): void
{
    global $wpdb;
    $index = core_client_index_table();
    $post_id = $wpdb->get_var($wpdb->prepare(
        "SELECT post_id FROM $index WHERE datatype = %s AND connection_id = %s AND remote_id = %s",
        $datatype,
        $connection_id,
        $remote_id,
    ));
    if ($post_id === null) {
        return;
    }
    $wpdb->delete($index, ['post_id' => (int) $post_id]);
    core_client_unlink((int) $post_id, $datatype, $remote_id);
    wp_delete_post((int) $post_id, true);
    do_action('core_item_deleted', (int) $post_id, $datatype);
}

/**
 * The item a post carries, as Core served it. `display.*` are the strings to show.
 *
 * @return array<string, mixed>|null
 */
/**
 * The posts and the meta of these items in two queries instead of two per item, before a list's
 * cards read them (Patric, 2026-10-03: the list's speed).
 *
 * @param list<int> $post_ids
 */
function core_client_prime(array $post_ids): void
{
    if ($post_ids !== []) {
        _prime_post_caches($post_ids, false, false);
        update_meta_cache('post', $post_ids);
    }
}

/**
 * One stored record's universal data, or null when the post holds none.
 *
 * @return array<string, mixed>|null
 */
function core_client_item(int $post_id): ?array
{
    $json = get_post_meta($post_id, 'core_data', true);
    $data = is_string($json) ? json_decode($json, true) : null;
    return is_array($data) ? $data : null;
}

/**
 * The CRM payload the post carries, exactly as Core served it: whatever `data` does not name yet.
 *
 * @return array<string, mixed>|null
 */
function core_client_item_raw(int $post_id): ?array
{
    $json = get_post_meta($post_id, 'core_raw', true);
    $raw = is_string($json) ? json_decode($json, true) : null;
    return is_array($raw) ? $raw : null;
}

/**
 * The post that holds an item, by datatype and the record's id, in any connection; null when the
 * site has none, or holds it as a draft (the site's own records). What a single page uses to
 * reach the records an item points at.
 */
function core_client_post_id(string $datatype, string $remote_id): ?int
{
    global $wpdb;
    $index = core_client_index_table();
    $post_id = $wpdb->get_var($wpdb->prepare(
        "SELECT i.post_id FROM $index i JOIN {$wpdb->posts} p ON p.ID = i.post_id WHERE i.datatype = %s AND i.remote_id = %s AND p.post_status = 'publish'",
        $datatype,
        $remote_id,
    ));
    return $post_id === null ? null : (int) $post_id;
}

/**
 * The items a list of ids names, in the order given, each with its post id; ids the site does not
 * hold are left out. What a single page uses for the agents, the office or the association an
 * item points at.
 *
 * @param list<mixed> $ids
 * @return list<array{post_id: int, item: array<string, mixed>}>
 */
function core_client_items(string $datatype, array $ids): array
{
    $items = [];
    foreach ($ids as $id) {
        if (!is_string($id) || $id === '') {
            continue;
        }
        $post_id = core_client_post_id($datatype, $id);
        $item = $post_id === null ? null : core_client_item($post_id);
        if ($item !== null) {
            $items[] = ['post_id' => $post_id, 'item' => $item];
        }
    }
    return $items;
}
