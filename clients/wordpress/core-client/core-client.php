<?php
/**
 * Plugin Name: Kowboy Core Client
 * Plugin URI: https://kowboy.se/core-client
 * Description: Keeps this site's copy of its Kowboy Core data current, and renders only from that copy.
 * Version: 0.3.1
 * Requires at least: 6.8
 * Requires PHP: 8.2
 * Author: Kowboy Media
 * Update URI: https://kowboy.se/core-client
 */

// The thin client (SRS Appendix A): three settings, a bell endpoint, the sync loop and a local
// store, plus what every template asks of it: the query function, the template sets and the
// one list function (docs/default-templates.md). No data logic, no CRM knowledge.

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const CORE_CLIENT_VERSION = '0.3.1';
const CORE_CLIENT_FILE = __FILE__;

// Action Scheduler, bundled: the job queue for the scheduled sync (includes/schedule.php). It
// registers itself and loads the newest copy any plugin on the site brings.
require_once __DIR__ . '/lib/action-scheduler/action-scheduler.php';

require __DIR__ . '/includes/report.php';
require __DIR__ . '/includes/settings.php';
require __DIR__ . '/includes/store.php';
require __DIR__ . '/includes/routing.php';
require __DIR__ . '/includes/query.php';
require __DIR__ . '/includes/templates.php';
require __DIR__ . '/includes/debug.php';
require __DIR__ . '/includes/packages.php';
require __DIR__ . '/includes/sync.php';
require __DIR__ . '/includes/bell.php';
require __DIR__ . '/includes/schedule.php';
if (defined('WP_CLI') && WP_CLI) {
    require __DIR__ . '/includes/cli.php';
}
