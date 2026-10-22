<?php
/**
 * Plugin Name: Core client templates: fixture
 * Description: A test fixture (clients/wordpress/test): the smallest set plugin, so the plugin's set machinery is proved apart from the theme.
 * Version: 0.1.0
 * Requires PHP: 8.2
 * Update URI: https://kowboy.se/core-client-templates-fixture
 */

declare(strict_types=1);

add_action('plugins_loaded', function (): void {
    if (function_exists('core_client_register_template_set')) {
        core_client_register_template_set('fixture', 'Fixture set', __FILE__, '0.1.0');
    }
});
