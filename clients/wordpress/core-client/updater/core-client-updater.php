<?php
/**
 * Plugin Name: Kowboy Core Client updater
 * Description: Tells WordPress where Kowboy Core Client releases come from, and keeps the plugin and its template sets updated. Never depends on the plugin it updates.
 */

// Safe update (SRS §8): this file is a must-use plugin, placed here by the client plugin on
// activation, loaded before and independently of it, so a broken release is replaced by the next
// one without a manual step. WordPress does the downloading and swapping itself; this only answers
// "is there a newer one?", for every package on the site's list: the plugin and each template set.
//
// The list is the option `core_client_packages`, which the plugin keeps current:
//   {"channel": "https://…/", "packages": {"core-client": "core-client/core-client.php", …}}
// A site may pin the channel in wp-config.php: define('CORE_CLIENT_CHANNEL', 'https://…/');
// Each package's release JSON sits at <channel><package>/<package>.json:
//   {"version": "1.2.0", "package": "https://…/core-client/core-client-1.2.0.zip"}

declare(strict_types=1);

/** @return array{channel: string, packages: array<string, string>} */
function core_client_updater_watched(): array
{
    $option = get_option('core_client_packages');
    $packages = is_array($option) && is_array($option['packages'] ?? null) ? $option['packages'] : [];
    $channel = defined('CORE_CLIENT_CHANNEL')
        ? (string) constant('CORE_CLIENT_CHANNEL')
        : (is_array($option) ? (string) ($option['channel'] ?? '') : '');
    return ['channel' => $channel === '' ? '' : rtrim($channel, '/') . '/', 'packages' => $packages];
}

// Every package's header says `Update URI: https://kowboy.se/<package>`; WordPress asks this hook.
add_filter('update_plugins_kowboy.se', function ($update, array $plugin_data, string $plugin_file) {
    $watched = core_client_updater_watched();
    $package = array_search($plugin_file, $watched['packages'], true);
    if (!is_string($package) || $watched['channel'] === '') {
        return $update;
    }
    $response = wp_remote_get($watched['channel'] . $package . '/' . $package . '.json', ['timeout' => 10]);
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
        return $update;
    }
    $release = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($release) || !is_string($release['version'] ?? null) || !is_string($release['package'] ?? null)) {
        return $update;
    }
    if (version_compare($release['version'], (string) $plugin_data['Version'], '<=')) {
        return false;
    }
    return [
        'id' => $watched['channel'] . $package,
        'slug' => $package,
        'version' => $release['version'],
        'url' => 'https://kowboy.se/' . $package,
        'package' => $release['package'],
    ];
}, 10, 3);

add_filter('auto_update_plugin', function ($update, $item) {
    $slug = is_object($item) ? (string) ($item->slug ?? '') : '';
    return $slug !== '' && isset(core_client_updater_watched()['packages'][$slug]) ? true : $update;
}, 10, 2);
