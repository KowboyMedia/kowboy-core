<?php
// WP-CLI (SRS Appendix A). `core` itself is WP-CLI's own namespace, so the commands live under
// `core-client`: `wp core-client sync`, `wp core-client sync --force`, `wp core-client status`.

declare(strict_types=1);

WP_CLI::add_command(
    'core-client sync',
    function (array $args, array $assoc): void {
        $status = core_client_sync(isset($assoc['force']) ? 'forcerefresh' : 'delta');
        if ($status['last_error'] !== null) {
            WP_CLI::error((string) $status['last_error']);
        }
        WP_CLI::success('synced: ' . wp_json_encode($status['items']));
    },
    [
        'shortdesc' => 'Pull changes from Core now. --force rewrites every item.',
        'synopsis' => [['type' => 'flag', 'name' => 'force', 'optional' => true]],
    ],
);

WP_CLI::add_command(
    'core-client status',
    function (): void {
        WP_CLI::line((string) wp_json_encode(core_client_status(), JSON_PRETTY_PRINT));
    },
    ['shortdesc' => 'Cursors, item counts and the last sync.'],
);
