<?php
/**
 * Plugin Name: Kowboy Core Client
 * Plugin URI: https://kowboy.se/core-client
 * Description: Keeps this site's copy of its Kowboy Core data current, and renders only from that copy.
 * Version: 0.1.0
 * Requires at least: 6.8
 * Requires PHP: 8.3
 * Author: Kowboy Media
 * Update URI: https://kowboy.se/core-client
 */

// The thin client (SRS Appendix A): three settings, a bell endpoint, the sync loop and a local
// store. No data logic, no CRM knowledge. Templates come with the data model.

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const CORE_CLIENT_VERSION = '0.1.0';
const CORE_CLIENT_FILE = __FILE__;

require __DIR__ . '/includes/report.php';
require __DIR__ . '/includes/settings.php';
require __DIR__ . '/includes/store.php';
require __DIR__ . '/includes/sync.php';
require __DIR__ . '/includes/bell.php';
require __DIR__ . '/includes/schedule.php';
if (defined('WP_CLI') && WP_CLI) {
    require __DIR__ . '/includes/cli.php';
}
