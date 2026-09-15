<?php
/**
 * Plugin Name: Kowboy Core Client updater
 * Description: Tells WordPress where Kowboy Core Client releases come from, and keeps it updated. Never depends on the plugin it updates.
 */

// Safe update (SRS §8): this file is a must-use plugin, loaded before and independently of the
// client plugin, so a broken client release is replaced by the next one without a manual step.
// WordPress does the downloading and swapping itself; this only answers "is there a newer one?".
//
// wp-config.php:  define('CORE_CLIENT_UPDATE_URL', 'https://…/core-client.json');
// That JSON:      {"version": "1.2.0", "package": "https://…/core-client-1.2.0.zip"}

declare(strict_types=1);

if (!defined('CORE_CLIENT_UPDATE_URL')) {
    return;
}

// The plugin's header says `Update URI: https://kowboy.se/core-client`; WordPress asks this hook.
add_filter('update_plugins_kowboy.se', function ($update, array $plugin_data, string $plugin_file) {
    if ($plugin_file !== 'core-client/core-client.php') {
        return $update;
    }
    $response = wp_remote_get(CORE_CLIENT_UPDATE_URL, ['timeout' => 10]);
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
        'id' => CORE_CLIENT_UPDATE_URL,
        'slug' => 'core-client',
        'version' => $release['version'],
        'url' => 'https://kowboy.se/core-client',
        'package' => $release['package'],
    ];
}, 10, 3);

add_filter('auto_update_plugin', fn ($update, $item) => ($item->slug ?? '') === 'core-client' ? true : $update, 10, 2);
