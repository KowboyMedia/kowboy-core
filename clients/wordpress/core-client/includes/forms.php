<?php
// The forms (docs/forms.md, "Built 2026-10-06: the first version"; questions 150 a and 155): the
// plugin has nothing of its own for a form but its two receivers on the WordPress API, one that
// passes a filled form on and one that reads a viewing's times, and the bot check's public key,
// which the theme renders the challenge with. The theme draws the forms in the page and talks
// only to this site's own server; the receivers call Core with the token the site already syncs
// with, over Core's server door, and hand Core's answer back as it came. The token never reaches
// the page, and nothing in a form is read here.

declare(strict_types=1);

add_action('rest_api_init', function (): void {
    register_rest_route('core/v1', '/forms', [
        'methods' => 'POST',
        // A visitor's form: Core authenticates the site, by the token this server adds; the visitor has no account.
        'permission_callback' => '__return_true',
        'callback' => 'core_client_forms_receive',
    ]);
    register_rest_route('core/v1', '/forms/slots', [
        'methods' => 'GET',
        // The booking window's times: as public as the home's page; Core refuses a home that is not this site's tenant's.
        'permission_callback' => '__return_true',
        'callback' => 'core_client_forms_slots',
    ]);
});

/**
 * Pass a filled form on to Core and answer as Core answered. The body is the universal submission
 * the theme built (schemas/submission.v1.json): Core checks it against the schema, finds the
 * tenant's connection from the token and refuses a home that is not the tenant's; this function
 * decides nothing from it. The bot check's proof the window earned goes along as it came, and
 * Core verifies it. 200 delivered, 409 refused with the reason, 429 too many, else failed
 * (docs/forms.md, "Core's part").
 */
function core_client_forms_receive(WP_REST_Request $request): WP_REST_Response
{
    $settings = core_client_settings();
    if ($settings['url'] === '' || $settings['token'] === '') {
        return new WP_REST_Response(['status' => 'failed', 'error' => 'this site is not linked to Core'], 503);
    }
    // The body goes on as it came, once it is a JSON object: decoded and encoded again, an empty
    // object (the source's UTM tags on a page without any) would turn into an empty list.
    $body = $request->get_body();
    if (!(json_decode($body) instanceof stdClass)) {
        return new WP_REST_Response(['error' => 'the body is not a form'], 400);
    }
    $headers = core_client_forms_headers($settings);
    $headers['Content-Type'] = 'application/json';
    // Which site sent it, as on a pull, so the form's events show on this site's row in Core.
    $headers['X-Core-Site'] = rest_url('core/v1/bell');
    $human = trim((string) $request->get_header('x_core_human'));
    if ($human !== '') {
        $headers['X-Core-Human'] = $human;
    }
    $response = wp_remote_post($settings['url'] . '/v1/submissions', [
        'timeout' => 25, // Core itself waits at most 20 s for the CRM
        'headers' => $headers,
        'body' => $body,
    ]);
    return core_client_forms_answer($response, 'a form did not reach Core');
}

/**
 * A viewing's times for the booking window, read from Core as the CRM has them now. The home is
 * named as the page's button names it, by its connection and its id; Core refuses one that is not
 * this site's tenant's. Core's answer goes back as it came.
 */
function core_client_forms_slots(WP_REST_Request $request): WP_REST_Response
{
    $settings = core_client_settings();
    if ($settings['url'] === '' || $settings['token'] === '') {
        return new WP_REST_Response(['error' => 'this site is not linked to Core'], 503);
    }
    $query = http_build_query([
        'connection_id' => (string) $request->get_param('connection_id'),
        'remote_id' => (string) $request->get_param('remote_id'),
    ]);
    $response = wp_remote_get($settings['url'] . '/v1/submissions/slots?' . $query, [
        'timeout' => 25,
        'headers' => core_client_forms_headers($settings),
    ]);
    return core_client_forms_answer($response, 'a viewing\'s times did not come from Core');
}

/** What every call to Core's forms addresses carries: the site's token and the plugin's version. */
function core_client_forms_headers(array $settings): array
{
    return [
        'Authorization' => 'Bearer ' . $settings['token'],
        'X-Core-Client' => 'wordpress/' . CORE_CLIENT_VERSION,
    ];
}

/** Core's status and answer as they came; a call that did not reach Core is a failure, reported. */
function core_client_forms_answer(array|WP_Error $response, string $failure): WP_REST_Response
{
    if ($response instanceof WP_Error) {
        // The network, never the form: no name, phone or e-mail is reported.
        core_client_report($failure, ['where' => 'forms.php', 'detail' => $response->get_error_message()]);
        return new WP_REST_Response(['status' => 'failed'], 502);
    }
    $status = (int) wp_remote_retrieve_response_code($response);
    $answer = json_decode((string) wp_remote_retrieve_body($response), true);
    return new WP_REST_Response(is_array($answer) ? $answer : ['status' => 'failed'], $status > 0 ? $status : 502);
}

/**
 * The bot check's public key for the form window, as Core gives it (`provider` and `site_key`),
 * or null while Core has none or cannot be reached. Asked of Core once an hour, and a failed read
 * again after five minutes, so a page waits on Core at most once in that time.
 *
 * @return array{provider: string, site_key: string}|null
 */
function core_client_human_check(): ?array
{
    $settings = core_client_settings();
    if ($settings['url'] === '' || $settings['token'] === '') {
        return null;
    }
    // Kept per Core and token, so a site linked anew reads the key afresh.
    $transient = 'core_client_human_check_' . md5($settings['url'] . '|' . $settings['token']);
    $cached = get_transient($transient);
    if (is_array($cached)) {
        return $cached['human'] ?? null;
    }
    $response = wp_remote_get($settings['url'] . '/v1/submissions/bot-check', [
        'timeout' => 5,
        'headers' => core_client_forms_headers($settings),
    ]);
    $read = !($response instanceof WP_Error) && (int) wp_remote_retrieve_response_code($response) === 200;
    $answer = $read ? json_decode((string) wp_remote_retrieve_body($response), true) : null;
    $given = is_array($answer) && is_array($answer['human'] ?? null) ? $answer['human'] : null;
    $human = $given !== null && is_string($given['provider'] ?? null) && is_string($given['site_key'] ?? null)
        ? ['provider' => $given['provider'], 'site_key' => $given['site_key']]
        : null;
    set_transient($transient, ['human' => $human], is_array($answer) ? HOUR_IN_SECONDS : 5 * MINUTE_IN_SECONDS);
    return $human;
}
