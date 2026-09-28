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

/** One post type per datatype, under its Swedish path. Called on `init`, and by the activation hook before it flushes the rewrite rules. */
function core_client_register_post_types(): void
{
    foreach (core_client_datatypes() as $datatype) {
        register_post_type(core_client_post_type($datatype), [
            'label' => ucfirst($datatype),
            'public' => true,
            'has_archive' => true,
            'rewrite' => ['slug' => core_client_path($datatype)],
            'supports' => ['title'],
            'show_in_rest' => false,
        ]);
    }
}

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
    // The search columns are copies of universal names (docs/field-tables.md), filled on every
    // write, so a list query never opens the JSON. `agent_ids` is `,id,id,` for one LIKE.
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
        office_ids text DEFAULT NULL,
        area_id varchar(191) DEFAULT NULL,
        PRIMARY KEY  (post_id),
        UNIQUE KEY item (datatype, connection_id, remote_id),
        KEY listing (datatype, status_id, published_at),
        KEY project (project_id)
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
        // An update arrives without the activation hook: rebuild the rewrite rules once the post types are registered.
        add_action('init', 'flush_rewrite_rules', 20);
    }
});

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
        'post_name' => sanitize_title($item->connection_id . '-' . $item->remote_id),
    ];
    if ($existing !== null) {
        $post['ID'] = (int) $existing->post_id;
    }
    $post_id = $existing !== null ? wp_update_post($post, true) : wp_insert_post($post, true);
    if (is_wp_error($post_id)) {
        throw new RuntimeException($post_id->get_error_message());
    }

    update_post_meta($post_id, 'core_data', wp_slash((string) wp_json_encode($item->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
    // The CRM payload exactly as Core served it, next to the data (Patric, 2026-09-18).
    update_post_meta($post_id, 'core_raw', wp_slash((string) wp_json_encode($item->raw ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));

    // `synced_at` is bookkeeping for the rebuild sweep only; nothing else may key on it.
    core_client_replace_index_row([
        'post_id' => $post_id,
        'datatype' => $datatype,
        'connection_id' => $item->connection_id,
        'remote_id' => $item->remote_id,
        'office_id' => $item->office_id,
        'seq' => $item->seq,
        'content_hash' => $item->content_hash,
        'remote_updated_at' => $remote === false ? null : gmdate('Y-m-d H:i:s', $remote),
        'synced_at' => 'now',
        ...core_client_search_columns(is_object($item->data) ? $item->data : new stdClass()),
    ]);

    clean_post_cache($post_id);
    do_action('core_item_updated', $post_id, $datatype);
    return $post_id;
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
 * @return array<string, string|float|null>
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
    $address = is_object($data->address ?? null) ? $data->address : new stdClass();
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
        'office_ids' => $ids($data->office_ids ?? null),
        'area_id' => $text($address->area_id ?? null),
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
    wp_delete_post((int) $post_id, true);
    do_action('core_item_deleted', (int) $post_id, $datatype);
}

/**
 * The item a post carries, as Core served it. `display.*` are the strings to show.
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
 * The post that holds an item, by datatype and the CRM's id, in any connection; null when the
 * site has none. What a single page uses to reach the records an item points at.
 */
function core_client_post_id(string $datatype, string $remote_id): ?int
{
    global $wpdb;
    $index = core_client_index_table();
    $post_id = $wpdb->get_var($wpdb->prepare(
        "SELECT i.post_id FROM $index i JOIN {$wpdb->posts} p ON p.ID = i.post_id WHERE i.datatype = %s AND i.remote_id = %s",
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
