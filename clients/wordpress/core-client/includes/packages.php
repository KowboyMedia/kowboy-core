<?php
// Installing and updating (docs/default-templates.md, "Installing and updating: the user's path").
// One upload, one click: on activation the plugin places the must-use updater itself. The updater
// reads one option this file keeps current: the update channel and the packages on the site (the
// plugin and every template set), and answers WordPress's own update check for each. Template sets
// are installed from the plugin's settings page, from the channel's index, by WordPress's own
// plugin installer.

declare(strict_types=1);

const CORE_CLIENT_UPDATER_FILE = 'core-client-updater.php';

/**
 * The update channel: the folder that holds `<package>/<package>.json` per package and
 * `sets.json`. From `CORE_CLIENT_CHANNEL` in wp-config.php when a site pins one (the staging
 * channel), else from `channel.json`, which the release writes into the plugin folder, else empty.
 */
function core_client_channel(): string
{
    if (defined('CORE_CLIENT_CHANNEL')) {
        return rtrim((string) constant('CORE_CLIENT_CHANNEL'), '/') . '/';
    }
    $file = dirname(CORE_CLIENT_FILE) . '/channel.json';
    if (!is_file($file)) {
        return '';
    }
    $release = json_decode((string) file_get_contents($file), true);
    $channel = is_array($release) ? ($release['channel'] ?? '') : '';
    return is_string($channel) && $channel !== '' ? rtrim($channel, '/') . '/' : '';
}

/** Copy the must-use updater into mu-plugins, so nobody copies a file by hand. */
function core_client_place_updater(): void
{
    $source = dirname(CORE_CLIENT_FILE) . '/updater/' . CORE_CLIENT_UPDATER_FILE;
    $target = WPMU_PLUGIN_DIR . '/' . CORE_CLIENT_UPDATER_FILE;
    if (!is_dir(WPMU_PLUGIN_DIR)) {
        wp_mkdir_p(WPMU_PLUGIN_DIR);
    }
    if (!is_file($target) || md5_file($target) !== md5_file($source)) {
        copy($source, $target);
    }
}

/**
 * What the updater watches: the channel, and per package the plugin file WordPress knows it by.
 * Written on every load, so a set activated today is watched today.
 */
add_action('plugins_loaded', function (): void {
    $packages = ['core-client' => plugin_basename(CORE_CLIENT_FILE)];
    foreach (core_client_template_sets() as $set) {
        $packages['core-client-templates-' . $set['slug']] = plugin_basename($set['file']);
    }
    $watched = ['channel' => core_client_channel(), 'packages' => $packages];
    if (get_option('core_client_packages') !== $watched) {
        update_option('core_client_packages', $watched, true);
    }
}, 20);

/**
 * The sets the channel offers (`sets.json`: slug, name, version, package), or an empty list when
 * there is no channel or it does not answer.
 *
 * @return list<array{slug: string, name: string, version: string, package: string}>
 */
function core_client_available_sets(): array
{
    $channel = core_client_channel();
    if ($channel === '') {
        return [];
    }
    $response = wp_remote_get($channel . 'sets.json', ['timeout' => 10]);
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
        return [];
    }
    $index = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($index)) {
        return [];
    }
    $sets = [];
    foreach ($index as $set) {
        if (is_array($set) && is_string($set['slug'] ?? null) && is_string($set['package'] ?? null)) {
            $sets[] = [
                'slug' => $set['slug'],
                'name' => (string) ($set['name'] ?? $set['slug']),
                'version' => (string) ($set['version'] ?? ''),
                'package' => $set['package'],
            ];
        }
    }
    return $sets;
}

/**
 * Install one set from its package, activate it and select it: the Install button on the settings
 * page. WordPress's own installer does the download and the unpacking.
 */
add_action('admin_post_core_client_install_set', function (): void {
    if (!current_user_can('install_plugins')) {
        wp_die('Not allowed.');
    }
    check_admin_referer('core_client_install_set');
    $slug = sanitize_key((string) ($_POST['slug'] ?? ''));
    $chosen = null;
    foreach (core_client_available_sets() as $set) {
        if ($set['slug'] === $slug) {
            $chosen = $set;
        }
    }
    if ($chosen === null) {
        wp_die('The channel does not offer that set.');
    }
    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    $upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());
    $installed = $upgrader->install($chosen['package']);
    $file = is_string($upgrader->plugin_info()) ? $upgrader->plugin_info() : null;
    if ($installed !== true || $file === null) {
        wp_die('The set could not be installed: ' . (is_wp_error($installed) ? $installed->get_error_message() : 'the package did not unpack'));
    }
    $activated = activate_plugin($file);
    if (is_wp_error($activated)) {
        wp_die('The set was installed but could not be activated: ' . $activated->get_error_message());
    }
    update_option('core_client_template_set', $slug);
    wp_safe_redirect(admin_url('options-general.php?page=core-client&set-installed=' . rawurlencode($slug)));
    exit;
});
