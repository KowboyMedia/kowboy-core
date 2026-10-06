<?php
// The forms (docs/forms.md, "Built 2026-10-06: the proof"; question 150 a): the plugin has nothing
// of its own for a form but its receivers on the WordPress API. The theme draws the form in the
// page and posts it to this site's own server; the receiver sends it on to Core with the token
// the site already syncs with, over Core's server door, and hands Core's answer back as it came.
// The token never reaches the page, and nothing in the form is read here. Until every form has
// moved into the theme, the widget's script tag below still opens Core's wizard for the buttons
// the theme does not draw itself (the viewing booking and the free valuation); the site key
// setting and the tag go with it.

declare(strict_types=1);

add_action('rest_api_init', function (): void {
    register_rest_route('core/v1', '/forms', [
        'methods' => 'POST',
        // A visitor's form: Core authenticates the site, by the token this server adds; the visitor has no account.
        'permission_callback' => '__return_true',
        'callback' => 'core_client_forms_receive',
    ]);
});

/**
 * Pass a filled form on to Core and answer as Core answered. The body is the universal submission
 * the theme built (schemas/submission.v1.json): Core checks it against the schema, finds the
 * tenant's connection from the token and refuses a home that is not the tenant's; this function
 * decides nothing from it. 200 delivered, 409 refused with the CRM's reason, 429 too many, else
 * failed (docs/forms.md, "Core's part").
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
    $response = wp_remote_post($settings['url'] . '/v1/submissions', [
        'timeout' => 25, // Core itself waits at most 20 s for the CRM
        'headers' => [
            'Authorization' => 'Bearer ' . $settings['token'],
            'Content-Type' => 'application/json',
            'X-Core-Client' => 'wordpress/' . CORE_CLIENT_VERSION,
            // Which site sent it, as on a pull, so the form's events show on this site's row in Core.
            'X-Core-Site' => rest_url('core/v1/bell'),
        ],
        'body' => $body,
    ]);
    if ($response instanceof WP_Error) {
        // The network, never the form: no name, phone or e-mail is reported.
        core_client_report('a form did not reach Core', ['where' => 'forms.php', 'detail' => $response->get_error_message()]);
        return new WP_REST_Response(['status' => 'failed'], 502);
    }
    $status = (int) wp_remote_retrieve_response_code($response);
    $answer = json_decode((string) wp_remote_retrieve_body($response), true);
    return new WP_REST_Response(is_array($answer) ? $answer : ['status' => 'failed'], $status > 0 ? $status : 502);
}

add_action('admin_init', function (): void {
    register_setting('core_client', 'core_client_site_key', ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field']);
});

/** The site's public key for Core's forms door, from the settings; '' while none is typed. */
function core_client_site_key(): string
{
    return trim((string) get_option('core_client_site_key', ''));
}

/** The widget's script tag, or '' while the site has no key or no Core URL. */
function core_client_forms_tag(): string
{
    $key = core_client_site_key();
    $url = core_client_settings()['url'];
    if ($key === '' || $url === '') {
        return '';
    }
    $attributes = ['src' => $url . '/widget/forms.js', 'data-site-key' => $key, 'defer' => true];
    $policy = (string) get_privacy_policy_url();
    if ($policy !== '') {
        $attributes['data-policy-url'] = $policy;
    }
    return wp_get_script_tag($attributes);
}

add_action('wp_footer', function (): void {
    echo core_client_forms_tag();
});
