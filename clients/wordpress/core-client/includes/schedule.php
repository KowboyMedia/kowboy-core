<?php
// The 15 minute backstop (SRS §8): a bell can be lost, so WP-Cron runs a sync on a schedule too.
// Bells themselves are answered inside the bell request (bell.php), so neither cron nor traffic is
// needed for those. A site with DISABLE_WP_CRON runs this schedule from system cron.

declare(strict_types=1);

add_action('core_client_backstop', function (): void {
    core_client_sync('delta');
});

add_filter('cron_schedules', function (array $schedules): array {
    $schedules['core_client_15min'] = ['interval' => 15 * MINUTE_IN_SECONDS, 'display' => 'Every 15 minutes'];
    return $schedules;
});

add_action('init', function (): void {
    if (wp_next_scheduled('core_client_backstop') === false) {
        wp_schedule_event(time(), 'core_client_15min', 'core_client_backstop');
    }
});

register_deactivation_hook(CORE_CLIENT_FILE, function (): void {
    wp_clear_scheduled_hook('core_client_backstop');
});
