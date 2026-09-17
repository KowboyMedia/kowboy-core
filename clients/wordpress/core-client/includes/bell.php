<?php
// The bell endpoint (SRS §5, Appendix A): POST /wp-json/core/v1/bell with X-Core-Secret. It
// carries no data; it means "something changed, come and pull". The pull happens in this same
// request, after the answer has gone out, so a bell is acted on whatever WP-Cron and traffic do.
//
// A GET on the same endpoint is a preview link Core made (strategy §5.3, AC 42):
// ?datatype=property&id=<remote id>&token=<hmac>. The site pulls first, so the page shows what
// Core holds now, then sends the visitor on to the item's page.

declare(strict_types=1);

add_action('rest_api_init', function (): void {
    register_rest_route('core/v1', '/bell', [
        [
            'methods' => 'POST',
            'permission_callback' => 'core_client_bell_permitted',
            'callback' => 'core_client_bell',
        ],
        [
            'methods' => 'GET',
            'permission_callback' => 'core_client_preview_permitted',
            'callback' => 'core_client_preview',
        ],
    ]);
});

/** The token is the permission: an HMAC of "datatype:id" with the bell secret, as Core makes it. */
function core_client_preview_permitted(WP_REST_Request $request): bool|WP_Error
{
    $secret = core_client_settings()['bell_secret'];
    $given = (string) $request->get_param('token');
    $expected = $secret === '' ? '' : hash_hmac(
        'sha256',
        (string) $request->get_param('datatype') . ':' . (string) $request->get_param('id'),
        $secret,
    );
    if ($expected === '' || $given === '' || !hash_equals($expected, $given)) {
        return new WP_Error('core_client_bad_token', 'bad token', ['status' => 401]);
    }
    return true;
}

/** Pull now, then on to the item's page with the token, which lets the page show what is not public. */
function core_client_preview(WP_REST_Request $request): WP_REST_Response
{
    $datatype = (string) $request->get_param('datatype');
    $remote_id = (string) $request->get_param('id');
    core_client_sync('delta');
    core_client_await_sync();
    $post_id = core_client_post_for($datatype, $remote_id);
    if ($post_id === null) {
        return new WP_REST_Response(['error' => 'not stored'], 404);
    }
    $response = new WP_REST_Response(null, 302);
    $response->header('Location', add_query_arg('core_preview', (string) $request->get_param('token'), (string) get_permalink($post_id)));
    return $response;
}

/** A sync that was already running works through the note this one left; wait for it, briefly. */
function core_client_await_sync(): void
{
    $deadline = microtime(true) + 10;
    while (microtime(true) < $deadline) {
        if (core_client_state('pending') === null && core_client_state('running_since') === null) {
            return;
        }
        usleep(200_000);
    }
}

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
