<?php
// Drives the WordPress install for the sync scenarios: boots WordPress, runs one command, prints
// one line of JSON. Everything it touches is the plugin's own, so it proves the plugin, not itself.
//
//   php driver.php configure '{"site":"http://127.0.0.1:8123","url":"<Core>","token":"…","bell_secret":"…"}'
//   php driver.php reset
//   php driver.php sync [delta|forcerefresh]
//   php driver.php backstop
//   php driver.php items <datatype>
//   php driver.php status
//   php driver.php damage '{"datatype":"property","remote_id":"P-1"}'
//   php driver.php update-check <url of a release json>

declare(strict_types=1);

$root = rtrim((string) getenv('WP_ROOT'), '/');
if ($root === '' || !is_file("$root/wp-load.php")) {
    fwrite(STDERR, "WP_ROOT must point at a WordPress checkout\n");
    exit(1);
}
$command = $argv[1] ?? '';
$argument = $argv[2] ?? '';

$_SERVER['HTTP_HOST'] = '127.0.0.1';
$_SERVER['REQUEST_URI'] = '/';
if ($command === 'update-check') {
    define('CORE_CLIENT_UPDATE_URL', $argument);
}
define('WP_USE_THEMES', false);
require "$root/wp-load.php";

// Nothing here reaches wordpress.org: the update check hears "no updates" from it instead.
add_filter('pre_http_request', function ($pre, array $args, string $url) {
    if (str_contains($url, 'api.wordpress.org')) {
        return [
            'headers' => [],
            'body' => '{"plugins":[],"translations":[],"no_update":[]}',
            'response' => ['code' => 200, 'message' => 'OK'],
            'cookies' => [],
            'filename' => null,
        ];
    }
    return $pre;
}, 10, 3);

/**
 * @param array<string, string> $settings
 * @return array<string, mixed>
 */
function core_driver_configure(array $settings): array
{
    update_option('siteurl', $settings['site']);
    update_option('home', $settings['site']);
    update_option('core_client_url', $settings['url']);
    update_option('core_client_token', $settings['token']);
    update_option('core_client_bell_secret', $settings['bell_secret']);
    return ['bell_url' => rest_url('core/v1/bell')];
}

/** @return array<string, mixed> */
function core_driver_reset(): array
{
    global $wpdb;
    foreach (core_client_datatypes() as $datatype) {
        $ids = get_posts(['post_type' => core_client_post_type($datatype), 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids']);
        foreach ($ids as $id) {
            wp_delete_post((int) $id, true);
        }
    }
    $wpdb->query('TRUNCATE TABLE ' . core_client_index_table());
    $wpdb->query('TRUNCATE TABLE ' . core_client_state_table());
    wp_unschedule_hook('core_client_run_sync');
    delete_transient('doing_cron');
    delete_site_transient('update_plugins');
    return ['ok' => true];
}

/** @return array<string, mixed> */
function core_driver_backstop(): array
{
    $scheduled = wp_next_scheduled('core_client_backstop') !== false;
    do_action('core_client_backstop');
    return ['scheduled' => $scheduled, 'status' => core_client_status()];
}

/** @return list<array<string, mixed>> */
function core_driver_items(string $datatype): array
{
    global $wpdb;
    $index = core_client_index_table();
    $rows = $wpdb->get_results($wpdb->prepare(
        "SELECT post_id, connection_id, remote_id, content_hash, synced_at FROM $index WHERE datatype = %s ORDER BY remote_id",
        $datatype,
    ));
    $items = [];
    foreach ($rows as $row) {
        $post = get_post((int) $row->post_id);
        // The meta as stored, decoded to objects so `{}` stays `{}` on the way out.
        $stored = get_post_meta((int) $row->post_id, 'core_data', true);
        $items[] = [
            'connection_id' => $row->connection_id,
            'remote_id' => $row->remote_id,
            'content_hash' => $row->content_hash,
            'synced_at' => $row->synced_at,
            'data' => is_string($stored) ? json_decode($stored) : null,
            'post_status' => $post?->post_status,
            'post_modified_gmt' => $post?->post_modified_gmt,
        ];
    }
    return $items;
}

/**
 * @param array<string, string> $spec
 * @return array<string, mixed>
 */
function core_driver_damage(array $spec): array
{
    global $wpdb;
    $index = core_client_index_table();
    $post_id = $wpdb->get_var($wpdb->prepare(
        "SELECT post_id FROM $index WHERE datatype = %s AND remote_id = %s",
        $spec['datatype'],
        $spec['remote_id'],
    ));
    if ($post_id === null) {
        return ['damaged' => false];
    }
    update_post_meta((int) $post_id, 'core_data', '{"damaged":true}');
    return ['damaged' => true];
}

/** @return array<string, mixed> */
function core_driver_update_check(): array
{
    delete_site_transient('update_plugins');
    wp_update_plugins();
    $updates = get_site_transient('update_plugins');
    $update = is_object($updates) ? ($updates->response['core-client/core-client.php'] ?? null) : null;
    return [
        'update' => is_object($update)
            ? ['version' => $update->new_version ?? $update->version ?? null, 'package' => $update->package ?? null]
            : null,
    ];
}

$result = match ($command) {
    'configure' => core_driver_configure((array) json_decode($argument, true)),
    'reset' => core_driver_reset(),
    'sync' => core_client_sync($argument === '' ? 'delta' : $argument),
    'backstop' => core_driver_backstop(),
    'items' => core_driver_items($argument),
    'status' => core_client_status(),
    'damage' => core_driver_damage((array) json_decode($argument, true)),
    'update-check' => core_driver_update_check(),
    default => null,
};
if ($result === null) {
    fwrite(STDERR, "unknown command: $command\n");
    exit(1);
}
echo json_encode($result), "\n";
