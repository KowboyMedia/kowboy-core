<?php
// Installs WordPress into the database wp-config.php names, and activates the client plugin.
// Idempotent. Run by setup.sh: WP-CLI does the same, this just does not need WP-CLI.

declare(strict_types=1);

$root = rtrim((string) getenv('WP_ROOT'), '/');
if ($root === '' || !is_file("$root/wp-load.php")) {
    fwrite(STDERR, "WP_ROOT must point at a WordPress checkout\n");
    exit(1);
}

define('WP_INSTALLING', true);
$_SERVER['HTTP_HOST'] = '127.0.0.1';
$_SERVER['REQUEST_URI'] = '/';
require "$root/wp-load.php";
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';

if (!is_blog_installed()) {
    wp_install('Core client test', 'admin', 'admin@example.com', true, '', wp_generate_password(24));
    echo "WordPress installed\n";
}

$result = activate_plugin('core-client/core-client.php');
if (is_wp_error($result)) {
    fwrite(STDERR, 'could not activate core-client: ' . $result->get_error_message() . "\n");
    exit(1);
}
echo "core-client active\n";
