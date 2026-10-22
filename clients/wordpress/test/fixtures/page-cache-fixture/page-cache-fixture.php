<?php
/**
 * Plugin Name: Page cache: fixture
 * Description: A test fixture (clients/wordpress/test): stands in for Cache Enabler by answering to its purge actions, so the plugin's page cache code runs on the test site's pages.
 * Version: 0.1.0
 * Requires PHP: 8.2
 * Update URI: https://kowboy.se/page-cache-fixture
 */

declare(strict_types=1);

foreach (['cache_enabler_clear_page_cache_by_url', 'cache_enabler_clear_site_cache'] as $page_cache_fixture_action) {
    add_action($page_cache_fixture_action, function (): void {
    });
}
