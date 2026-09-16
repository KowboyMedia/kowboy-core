<?php
// The bell endpoint (SRS §5, Appendix A): POST /wp-json/core/v1/bell with X-Core-Secret. It
// carries no data; it means "something changed, come and pull". The pull happens in this same
// request, after the answer has gone out, so a bell is acted on whatever WP-Cron and traffic do.

declare(strict_types=1);

add_action('rest_api_init', function (): void {
    register_rest_route('core/v1', '/bell', [
        'methods' => 'POST',
        'permission_callback' => 'core_client_bell_permitted',
        'callback' => 'core_client_bell',
    ]);
});

/** The secret is the permission. */
function core_client_bell_permitted(WP_REST_Request $request): bool|WP_Error
{
    $expected = core_client_settings()['bell_secret'];
    $given = (string) $request->get_header('x-core-secret');
    if ($expected === '' || !hash_equals($expected, $given)) {
        return new WP_Error('core_client_bad_secret', 'bad secret', ['status' => 401]);
    }
    return true;
}

/** Answer 202 at once, then pull: Core waits at most 10 s for a bell and never retries one. */
function core_client_bell(WP_REST_Request $request): never
{
    $body = $request->get_json_params();
    $kind = ($body['kind'] ?? '') === 'forcerefresh' ? 'forcerefresh' : 'delta';
    core_client_answer_then_continue(202, ['queued' => true]);
    core_client_sync($kind);
    exit;
}

/**
 * Send a complete answer now and keep this process alive for the work that follows. PHP-FPM hands
 * the answer back before the script ends; elsewhere the answer is complete by its length and the
 * connection closes when the script does.
 *
 * @param array<string, mixed> $body
 */
function core_client_answer_then_continue(int $status, array $body): void
{
    ignore_user_abort(true);
    set_time_limit(0); // a first sync of a large tenant outlasts a web request's usual limit
    $json = (string) wp_json_encode($body);
    status_header($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Length: ' . strlen($json));
    header('Connection: close');
    echo $json;
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
        return;
    }
    while (ob_get_level() > 0) {
        ob_end_flush();
    }
    flush();
}
