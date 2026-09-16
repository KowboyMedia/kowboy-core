<?php
// The local copy (SRS Appendix A): one post type per datatype carries each item, the full `data`
// sits in one JSON meta key, and one index table answers "which post holds this item" and the hash
// test. Templates read from here and never from Core. Columns for the search filters, routing and
// templates come with the data model (docs/field-tables.md).

declare(strict_types=1);

/**
 * Reference order (SRS §6.9): offices and agents before the properties that point at them.
 *
 * @return list<string>
 */
function core_client_datatypes(): array
{
    return ['office', 'agent', 'area', 'association', 'property'];
}

function core_client_post_type(string $datatype): string
{
    return 'core_' . $datatype;
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

add_action('init', function (): void {
    foreach (core_client_datatypes() as $datatype) {
        register_post_type(core_client_post_type($datatype), [
            'label' => ucfirst($datatype),
            'public' => true,
            'has_archive' => true,
            'rewrite' => ['slug' => $datatype === 'property' ? 'objekt' : $datatype],
            'supports' => ['title'],
            'show_in_rest' => false,
        ]);
    }
});

/** Create or update the plugin's tables. Runs on activation and after a plugin update. */
function core_client_install(): void
{
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $charset = $wpdb->get_charset_collate();
    $index = core_client_index_table();
    $state = core_client_state_table();
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
        PRIMARY KEY  (post_id),
        UNIQUE KEY item (datatype, connection_id, remote_id)
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
    flush_rewrite_rules();
});

add_action('plugins_loaded', function (): void {
    if (get_option('core_client_db_version') !== CORE_CLIENT_VERSION) {
        core_client_install();
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

    // "Updated" is the CRM's own time, never this write (SRS §7.1): sitemaps read post_modified.
    // A time in the future would make WordPress schedule the post instead of publishing it.
    $remote = is_string($item->remote_updated_at) ? strtotime($item->remote_updated_at) : false;
    $when = gmdate('Y-m-d H:i:s', $remote === false ? time() : min($remote, time()));

    $post = [
        'post_type' => core_client_post_type($datatype),
        'post_status' => 'publish',
        'post_title' => (string) ($item->data->id ?? $item->remote_id),
        'post_name' => sanitize_title($item->connection_id . '-' . $item->remote_id),
        'post_date_gmt' => $when,
        'post_date' => get_date_from_gmt($when),
    ];
    if ($existing !== null) {
        $post['ID'] = (int) $existing->post_id;
    }
    $post_id = $existing !== null ? wp_update_post($post, true) : wp_insert_post($post, true);
    if (is_wp_error($post_id)) {
        throw new RuntimeException($post_id->get_error_message());
    }

    update_post_meta($post_id, 'core_data', wp_slash((string) wp_json_encode($item->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
    $wpdb->update($wpdb->posts, ['post_modified_gmt' => $when, 'post_modified' => get_date_from_gmt($when)], ['ID' => $post_id]);

    // `synced_at` is bookkeeping for the rebuild sweep only; nothing else may key on it.
    $index = core_client_index_table();
    $wpdb->query($wpdb->prepare(
        "INSERT INTO $index (post_id, datatype, connection_id, remote_id, office_id, seq, content_hash, remote_updated_at, synced_at)
         VALUES (%d, %s, %s, %s, %s, %d, %s, %s, NOW(6))
         ON DUPLICATE KEY UPDATE post_id = VALUES(post_id), office_id = VALUES(office_id), seq = VALUES(seq),
           content_hash = VALUES(content_hash), remote_updated_at = VALUES(remote_updated_at), synced_at = NOW(6)",
        $post_id,
        $datatype,
        $item->connection_id,
        $item->remote_id,
        $item->office_id,
        $item->seq,
        $item->content_hash,
        $remote === false ? null : gmdate('Y-m-d H:i:s', $remote),
    ));

    clean_post_cache($post_id);
    do_action('core_item_updated', $post_id, $datatype);
    return $post_id;
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
