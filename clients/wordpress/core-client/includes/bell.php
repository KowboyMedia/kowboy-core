<?php
// The bell endpoint (SRS §5, Appendix A): POST /wp-json/core/v1/bell with X-Core-Secret. It
// carries no data; it means "something changed, come and pull".

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

/** Answer 202 at once and sync in the background: Core waits at most 10 s and never retries a bell. */
function core_client_bell(WP_REST_Request $request): WP_REST_Response
{
    $body = $request->get_json_params();
    $kind = is_array($body) && ($body['kind'] ?? '') === 'forcerefresh' ? 'forcerefresh' : 'delta';
    core_client_schedule_sync($kind);
    return new WP_REST_Response(['queued' => true], 202);
}
