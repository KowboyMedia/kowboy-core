<?php
// The forms widget (docs/forms.md, "The clients' part"): the one script tag that makes every
// button marked data-core-form open Core's wizard, with this site's public site key and the
// site's privacy policy for the consent line. Nothing else lives here: the buttons are the
// theme's, the wizard and the sending are Core's. Without a site key no tag is printed and the
// buttons lead where the theme points them.

declare(strict_types=1);

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
