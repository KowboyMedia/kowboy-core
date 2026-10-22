#!/usr/bin/env bash
# Prepares a WordPress install for the client tests, idempotently. Needs php, git, curl and a
# MariaDB or MySQL database the settings below can reach. Run it once, then `npm run test:wordpress`.
#
#   WP_ROOT          where WordPress goes           default ~/.cache/kowboy-core/wordpress
#   WP_VERSION       the WordPress release tag      default 7.1
#   WP_DB_HOST, WP_DB_NAME, WP_DB_USER, WP_DB_PASSWORD
#                    the database                   default 127.0.0.1, core_client_test, core, core
set -euo pipefail

repo=$(cd "$(dirname "$0")/../../.." && pwd)
WP_ROOT="${WP_ROOT:-$HOME/.cache/kowboy-core/wordpress}"
WP_VERSION="${WP_VERSION:-7.1}"

if [ ! -f "$WP_ROOT/wp-load.php" ]; then
  git clone --quiet --depth 1 --branch "$WP_VERSION" https://github.com/WordPress/WordPress.git "$WP_ROOT"
fi

# WP-CLI, for the commands the plugin adds. The phar comes from the project's own build mirror.
if [ ! -f "$WP_ROOT/../wp-cli.phar" ]; then
  curl -sSL -o "$WP_ROOT/../wp-cli.phar" https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
fi

cat > "$WP_ROOT/wp-config.php" <<CONFIG
<?php
// Written by clients/wordpress/test/setup.sh for the client tests. Not for any real site.
define('DB_NAME', '${WP_DB_NAME:-core_client_test}');
define('DB_USER', '${WP_DB_USER:-core}');
define('DB_PASSWORD', '${WP_DB_PASSWORD:-core}');
define('DB_HOST', '${WP_DB_HOST:-127.0.0.1}');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
define('AUTH_KEY', 'test-only');
define('SECURE_AUTH_KEY', 'test-only');
define('LOGGED_IN_KEY', 'test-only');
define('NONCE_KEY', 'test-only');
define('AUTH_SALT', 'test-only');
define('SECURE_AUTH_SALT', 'test-only');
define('LOGGED_IN_SALT', 'test-only');
define('NONCE_SALT', 'test-only');
\$table_prefix = 'wp_';
define('WP_DEBUG', true);
define('WP_DEBUG_DISPLAY', false);
define('WP_DEBUG_LOG', true);
define('WP_ENVIRONMENT_TYPE', 'local');
define('DISABLE_WP_CRON', true);
if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}
require_once ABSPATH . 'wp-settings.php';
CONFIG

ln -sfn "$repo/clients/wordpress/core-client" "$WP_ROOT/wp-content/plugins/core-client"
# The theme "Kowboy 2026", the default set (docs/kowboy-2026.md), and a fixture set plugin
# that proves the plugin's set machinery (the registry, the override rule, the sets on offer).
ln -sfn "$repo/clients/wordpress/themes/kowboy-2026" "$WP_ROOT/wp-content/themes/kowboy-2026"
ln -sfn "$repo/clients/wordpress/test/fixtures/core-client-templates-fixture" "$WP_ROOT/wp-content/plugins/core-client-templates-fixture"
# A stand-in for Cache Enabler, switched on by the page cache test alone.
ln -sfn "$repo/clients/wordpress/test/fixtures/page-cache-fixture" "$WP_ROOT/wp-content/plugins/page-cache-fixture"
mkdir -p "$WP_ROOT/wp-content/mu-plugins"
# The plugin places the updater itself on activation (includes/packages.php); a symlink keeps the
# test install on the repository's copy.
ln -sfn "$repo/clients/wordpress/core-client/updater/core-client-updater.php" "$WP_ROOT/wp-content/mu-plugins/core-client-updater.php"

# In the test install, Action Scheduler runs actions only when the driver asks it to.
cat > "$WP_ROOT/wp-content/mu-plugins/core-client-test-runner.php" <<'RUNNER'
<?php
// Written by clients/wordpress/test/setup.sh. Not for any real site.
add_filter('action_scheduler_allow_async_request_runner', '__return_false');
add_filter('action_scheduler_disable_default_runner', '__return_true');
RUNNER

# A browser journey asks for style isolation by a header on each request (the project "isolated"
# in playwright.config.ts), so the journeys walk both ways a site renders its views without the
# site changing between them.
cat > "$WP_ROOT/wp-content/mu-plugins/core-client-test-isolation.php" <<'ISOLATION'
<?php
// Written by clients/wordpress/test/setup.sh. Not for any real site.
add_filter('pre_option_core_client_styleisolation', fn (mixed $value): mixed => ($_SERVER['HTTP_X_CORE_STYLEISOLATION'] ?? '') === '1' ? '1' : $value);
ISOLATION

# A test asks for WordPress's security codes (nonces) to expire within seconds by a header, as a
# day-old copy of a page meets them, so it can prove a form needs none (next-steps item 32).
cat > "$WP_ROOT/wp-content/mu-plugins/core-client-test-nonce-life.php" <<'NONCE'
<?php
// Written by clients/wordpress/test/setup.sh. Not for any real site.
add_filter('nonce_life', fn (int $life): int => (int) ($_SERVER['HTTP_X_CORE_NONCE_LIFE'] ?? 0) > 0 ? (int) $_SERVER['HTTP_X_CORE_NONCE_LIFE'] : $life);
NONCE

WP_ROOT="$WP_ROOT" php "$repo/clients/wordpress/test/install.php"
echo "WordPress ready at $WP_ROOT"
