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
//   php driver.php update-check <url of an update channel folder>
//   php driver.php sets <url of an update channel folder>
//   php driver.php option <name> [<json value>]
//   php driver.php import '{"datatype":"property","data":{...},"raw":{...}}'   one item straight into the store
//   php driver.php typed '{"datatype":"agent","post":{"post_title":"…","post_status":"publish"},"fields":{...}}'   a record the site types itself
//   php driver.php inside '{"lat":59.3,"lng":18.0,"polygon":[[[[lng,lat],...]]]}'   whether the point lies in the outline
//   php driver.php links   the home-to-area links as the plugin holds them

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
if ($command === 'update-check' || $command === 'sets') {
    define('CORE_CLIENT_CHANNEL', $argument);
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
    $wpdb->query('TRUNCATE TABLE ' . core_client_links_table());
    $wpdb->query('TRUNCATE TABLE ' . core_client_state_table());
    as_unschedule_all_actions('core_client_backstop'); // the next boot schedules it afresh, due at once
    delete_site_transient('update_plugins');
    return ['ok' => true];
}

/**
 * Run a sync and count the WordPress actions it fired, the ones cache plugins listen for.
 *
 * @return array<string, mixed>
 */
function core_driver_sync(string $kind): array
{
    $hooks = ['save_post' => 0, 'deleted_post' => 0, 'clean_post_cache' => 0, 'core_item_updated' => 0, 'core_item_deleted' => 0];
    foreach (array_keys($hooks) as $hook) {
        add_action($hook, function () use (&$hooks, $hook): void {
            $hooks[$hook] += 1;
        });
    }
    $status = core_client_sync($kind);
    return ['status' => $status, 'hooks' => $hooks];
}

/** @return array<string, mixed> */
function core_driver_backstop(): array
{
    $scheduled = as_has_scheduled_action('core_client_backstop');
    // What Action Scheduler's own runners do from WP-Cron or at the end of a request: claim what
    // is due and run it. The test install disables those runners, so this is the only one.
    $processed = ActionScheduler::runner()->run('core-client driver');
    return ['scheduled' => $scheduled, 'processed' => $processed, 'status' => core_client_status()];
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
        $raw = get_post_meta((int) $row->post_id, 'core_raw', true);
        $items[] = [
            'connection_id' => $row->connection_id,
            'remote_id' => $row->remote_id,
            'content_hash' => $row->content_hash,
            'synced_at' => $row->synced_at,
            'data' => is_string($stored) ? json_decode($stored) : null,
            'raw' => is_string($raw) ? json_decode($raw) : null,
            'post_status' => $post?->post_status,
            'post_modified_gmt' => $post?->post_modified_gmt,
            'permalink' => get_permalink((int) $row->post_id),
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

/**
 * What WordPress's own update check hears for every package the updater watches.
 *
 * @return array<string, mixed>
 */
function core_driver_update_check(): array
{
    delete_site_transient('update_plugins');
    wp_update_plugins();
    $updates = get_site_transient('update_plugins');
    $offered = [];
    $packages = get_option('core_client_packages');
    foreach (is_array($packages) ? $packages['packages'] : [] as $package => $file) {
        $update = is_object($updates) ? ($updates->response[$file] ?? null) : null;
        $offered[$package] = is_object($update)
            ? ['version' => $update->new_version ?? $update->version ?? null, 'package' => $update->package ?? null]
            : null;
    }
    return ['update' => $offered['core-client'] ?? null, 'offered' => $offered];
}

/**
 * `theme <stylesheet>`: switch the test install's theme.
 *
 * @return array<string, mixed>
 */
function core_driver_theme(string $argument): array
{
    switch_theme(trim($argument));
    return ['theme' => get_option('stylesheet')];
}

/**
 * `demo-pages`: what the theme does on activation (its demo pages and menus), and the pages' addresses.
 *
 * @return array<string, mixed>
 */
function core_driver_demo_pages(): array
{
    do_action('after_switch_theme');
    $pages = [];
    foreach (['hem', 'till-salu', 'salda-bostader', 'om-oss'] as $slug) {
        $page = get_page_by_path($slug);
        $pages[$slug] = $page instanceof WP_Post ? get_permalink($page) : null;
    }
    return ['pages' => $pages, 'front' => (int) get_option('page_on_front')];
}

/**
 * `plugin activate|deactivate <plugin file>`: a test plugin (the fixture set) on or off.
 *
 * @return array<string, mixed>
 */
function core_driver_plugin(string $argument): array
{
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    [$action, $plugin] = explode(' ', trim($argument), 2) + ['', ''];
    if ($action === 'activate') {
        $result = activate_plugin($plugin);
        return ['active' => !is_wp_error($result), 'error' => is_wp_error($result) ? $result->get_error_message() : null];
    }
    deactivate_plugins($plugin);
    return ['active' => false, 'error' => null];
}

/**
 * Put one item into the local copy as if Core had served it, so a page can be rendered from a
 * golden record without a Core in between (the comparison against the master site).
 *
 * @param array<string, mixed> $spec
 * @return array<string, mixed>
 */
function core_driver_import(array $spec): array
{
    $datatype = (string) ($spec['datatype'] ?? 'property');
    $data = json_decode((string) json_encode($spec['data'] ?? []));
    $item = (object) [
        'connection_id' => 'golden',
        'remote_id' => (string) ($data->id ?? ''),
        'office_id' => is_string($data->office_id ?? null) ? $data->office_id : null,
        'seq' => (int) ($spec['seq'] ?? 1),
        'content_hash' => md5((string) json_encode($spec['data'] ?? [])),
        'remote_updated_at' => null,
        'data' => $data,
        'raw' => json_decode((string) json_encode($spec['raw'] ?? null)),
    ];
    $existing = core_client_index_row($datatype, 'golden', $item->remote_id);
    $post_id = core_client_upsert_item($datatype, $item, $existing);
    return ['post_id' => $post_id, 'permalink' => get_permalink($post_id)];
}

/**
 * A record the site types itself, saved the way the admin's form saves it: the form's fields in
 * $_POST with its nonce, as the administrator, through wp_insert_post (or wp_update_post with an
 * ID), so the plugin's own save path is what is proved. Without `fields` the post is saved as a
 * quick edit or a status change would save it: no form, the stored record kept.
 *
 * @param array<string, mixed> $spec
 * @return array<string, mixed>
 */
function core_driver_typed(array $spec): array
{
    wp_set_current_user((int) ($spec['user'] ?? 1));
    $post = ['post_type' => core_client_post_type((string) ($spec['datatype'] ?? 'agent')), ...(array) ($spec['post'] ?? [])];
    if (!isset($post['ID']) && isset($spec['fields'])) {
        // The admin's own flow: "Add New" makes the auto-draft whose id the form's nonce carries.
        $post['ID'] = (int) wp_insert_post(['post_type' => $post['post_type'], 'post_status' => 'auto-draft']);
    }
    if (isset($spec['fields'])) {
        $_POST['core_site_nonce'] = wp_create_nonce(CORE_CLIENT_SITE_NONCE . $post['ID']);
        $_POST['core_site'] = (array) $spec['fields'];
    }
    $post_id = isset($post['ID']) ? wp_update_post($post, true) : wp_insert_post($post, true);
    unset($_POST['core_site_nonce'], $_POST['core_site']);
    if (is_wp_error($post_id)) {
        return ['error' => $post_id->get_error_message()];
    }
    $item = core_client_item((int) $post_id);
    return ['post_id' => (int) $post_id, 'id' => $item['id'] ?? null, 'permalink' => get_permalink((int) $post_id), 'data' => $item];
}

/**
 * Read or write one option, so a test can pick the template set or switch shadow DOM on.
 *
 * @return array<string, mixed>
 */
function core_driver_option(string $argument): array
{
    [$name, $json] = explode(' ', $argument, 2) + ['', null];
    if ($json === 'null') {
        delete_option($name);
    } elseif ($json !== null) {
        update_option($name, json_decode($json, true));
    }
    return ['value' => get_option($name)];
}

/**
 * `inside`: the plugin's outline test on one point and one outline, for the hand-drawn shapes.
 *
 * @param array<string, mixed> $spec
 * @return array<string, mixed>
 */
function core_driver_inside(array $spec): array
{
    return ['inside' => core_client_point_in_polygon((float) $spec['lat'], (float) $spec['lng'], $spec['polygon'] ?? null)];
}

/**
 * `links`: every home-to-area link, as the record's id and the area's id, so a test reads the table itself.
 *
 * @return list<array{remote_id: string, area_id: string}>
 */
function core_driver_links(): array
{
    global $wpdb;
    $rows = $wpdb->get_results('SELECT i.remote_id, l.area_id FROM ' . core_client_links_table() . ' l JOIN ' . core_client_index_table() . ' i ON i.post_id = l.post_id ORDER BY i.remote_id, l.area_id', ARRAY_A);
    return array_map(fn (array $row): array => ['remote_id' => (string) $row['remote_id'], 'area_id' => (string) $row['area_id']], $rows ?: []);
}

$result = match ($command) {
    'configure' => core_driver_configure((array) json_decode($argument, true)),
    'reset' => core_driver_reset(),
    'sync' => core_driver_sync($argument === '' ? 'delta' : $argument),
    'backstop' => core_driver_backstop(),
    'items' => core_driver_items($argument),
    'status' => core_client_status(),
    'damage' => core_driver_damage((array) json_decode($argument, true)),
    'update-check' => core_driver_update_check(),
    'sets' => ['sets' => core_client_available_sets()],
    'option' => core_driver_option($argument),
    'plugin' => core_driver_plugin($argument),
    'theme' => core_driver_theme($argument),
    'demo-pages' => core_driver_demo_pages(),
    'import' => core_driver_import((array) json_decode($argument, true)),
    'typed' => core_driver_typed((array) json_decode($argument, true)),
    'inside' => core_driver_inside((array) json_decode($argument, true)),
    'links' => core_driver_links(),
    default => null,
};
if ($result === null) {
    fwrite(STDERR, "unknown command: $command\n");
    exit(1);
}
echo json_encode($result), "\n";
