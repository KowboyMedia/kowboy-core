<?php
// When the sync runs (SRS §8): right after a bell, through WP-Cron, and every 15 minutes as the
// backstop for a lost bell. A site on system cron (DISABLE_WP_CRON) runs both from there.

declare(strict_types=1);

add_action('core_client_run_sync', 'core_client_sync');
add_action('core_client_backstop', fn () => core_client_sync('delta'));

/** Run a sync as soon as WP-Cron can: leave the note now, so a running sync picks it up too. */
function core_client_schedule_sync(string $kind): void
{
    core_client_leave_note($kind);
    wp_schedule_single_event(time() - 1, 'core_client_run_sync', [$kind]);
    spawn_cron();
}

add_filter('cron_schedules', function (array $schedules): array {
    $schedules['core_client_15min'] = ['interval' => 15 * MINUTE_IN_SECONDS, 'display' => 'Every 15 minutes'];
    return $schedules;
});

add_action('init', function (): void {
    if (wp_next_scheduled('core_client_backstop') === false) {
        wp_schedule_event(time(), 'core_client_15min', 'core_client_backstop');
    }
});

register_deactivation_hook(CORE_CLIENT_FILE, fn () => wp_clear_scheduled_hook('core_client_backstop'));
