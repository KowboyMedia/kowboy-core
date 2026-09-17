<?php
// The 15 minute backstop (SRS §8): a bell can be lost, so a sync also runs on a schedule. The
// schedule is an Action Scheduler recurring action; the library is bundled (lib/action-scheduler),
// so no site installs a second one, and every run is logged under Tools → Scheduled Actions.
// Bells themselves are answered inside the bell request (bell.php) and need no queue.

declare(strict_types=1);

const CORE_CLIENT_BACKSTOP = 'core_client_backstop';

add_action(CORE_CLIENT_BACKSTOP, function (): void {
    core_client_sync('delta');
});

// Action Scheduler is ready on init. A recurring action stays scheduled once it exists.
add_action('init', function (): void {
    if (!as_has_scheduled_action(CORE_CLIENT_BACKSTOP)) {
        as_schedule_recurring_action(time(), 15 * MINUTE_IN_SECONDS, CORE_CLIENT_BACKSTOP, [], 'core-client');
    }
});

register_deactivation_hook(CORE_CLIENT_FILE, function (): void {
    as_unschedule_all_actions(CORE_CLIENT_BACKSTOP);
});
