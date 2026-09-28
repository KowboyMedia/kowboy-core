<?php
// The forms' entries (question 105 open): every submission of "Ska du sälja din bostad?" or
// "Är du intresserad av bostaden?" is stored as an entry under Förfrågningar in the admin, so
// nothing is lost, and mailed to the address in the theme options when one is set. The CRM
// path replaces the storing when 95 and 105 are answered.

declare(strict_types=1);

add_action('init', function (): void {
    register_post_type('kowboy_lead', [
        'labels' => [
            'name' => 'Förfrågningar',
            'singular_name' => 'Förfrågan',
            'menu_name' => 'Förfrågningar',
            'all_items' => 'Alla förfrågningar',
            'search_items' => 'Sök förfrågningar',
            'not_found' => 'Inga förfrågningar ännu.',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'menu_icon' => 'dashicons-email',
        'menu_position' => 25,
        'supports' => ['title', 'editor'],
        'capabilities' => ['create_posts' => 'do_not_allow'],
        'map_meta_cap' => true,
    ]);
});

/** `POST /wp-json/kowboy/v1/lead`: the form's fields, a consent, and what the page was about. */
add_action('rest_api_init', function (): void {
    register_rest_route('kowboy/v1', '/lead', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => 'kowboy_lead_received',
        'args' => [
            'first_name' => ['type' => 'string', 'required' => true],
            'last_name' => ['type' => 'string', 'required' => true],
            'phone' => ['type' => 'string', 'required' => true],
            'email' => ['type' => 'string', 'required' => true, 'format' => 'email'],
            'consent' => ['type' => 'boolean', 'required' => true],
            'subject' => ['type' => 'string', 'default' => ''],
            'page' => ['type' => 'string', 'default' => ''],
            'website' => ['type' => 'string', 'default' => ''],
        ],
    ]);
});

function kowboy_lead_received(WP_REST_Request $request): WP_REST_Response
{
    if ((string) $request['website'] !== '') {
        // The honeypot field a person never sees; a filled one is a robot, answered as if stored.
        return new WP_REST_Response(['stored' => true], 200);
    }
    if ($request['consent'] !== true) {
        return new WP_REST_Response(['error' => 'Samtycke till integritetspolicyn behövs.'], 400);
    }
    $fields = [
        'Förnamn' => sanitize_text_field((string) $request['first_name']),
        'Efternamn' => sanitize_text_field((string) $request['last_name']),
        'Mobil' => sanitize_text_field((string) $request['phone']),
        'E-post' => sanitize_email((string) $request['email']),
        'Gäller' => sanitize_text_field((string) $request['subject']),
        'Sida' => esc_url_raw((string) $request['page']),
    ];
    $lines = [];
    foreach ($fields as $label => $value) {
        if ($value !== '') {
            $lines[] = "$label: $value";
        }
    }
    $title = trim($fields['Förnamn'] . ' ' . $fields['Efternamn']) . ($fields['Gäller'] === '' ? '' : ' · ' . $fields['Gäller']);
    $stored = wp_insert_post([
        'post_type' => 'kowboy_lead',
        'post_status' => 'private',
        'post_title' => $title,
        'post_content' => implode("\n", $lines),
    ], true);
    if (is_wp_error($stored)) {
        return new WP_REST_Response(['error' => 'Förfrågan kunde inte sparas.'], 500);
    }
    $to = (string) kowboy_option('kowboy_form_email');
    if (is_email($to)) {
        wp_mail($to, 'Förfrågan: ' . $title, implode("\n", $lines), ['Reply-To: ' . $fields['E-post']]);
    }
    return new WP_REST_Response(['stored' => true], 200);
}
