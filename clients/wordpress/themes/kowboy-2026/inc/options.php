<?php
// The theme options, in WordPress's own Customizer (Utseende, Anpassa), with Swedish labels: the
// logotype in a bright and a dark variant, the main typography, the office's contact details
// for the footer, and the form's receiving address and privacy page.

declare(strict_types=1);

/** The theme's settings and their defaults, one place. */
const KOWBOY_OPTIONS = [
    'kowboy_logo_dark' => '',
    'kowboy_logo_bright' => '',
    'kowboy_display_size' => 48,
    'kowboy_display_weight' => 600,
    'kowboy_body_size' => 16,
    'kowboy_label_size' => 12,
    'kowboy_address' => '',
    'kowboy_phone' => '',
    'kowboy_email' => '',
    'kowboy_privacy_page' => 0,
    'kowboy_copyright' => 'Alla rättigheter reserverade.',
];

function kowboy_option(string $name): mixed
{
    return get_theme_mod($name, KOWBOY_OPTIONS[$name] ?? '');
}

add_action('customize_register', function (WP_Customize_Manager $customizer): void {
    $customizer->add_panel('kowboy', ['title' => 'Kowboy 2026', 'priority' => 10]);
    foreach (KOWBOY_OPTIONS as $name => $default) {
        $customizer->add_setting($name, ['default' => $default, 'sanitize_callback' => 'kowboy_sanitize_option']);
    }

    $customizer->add_section('kowboy_logo', ['title' => 'Logotyp', 'panel' => 'kowboy']);
    $customizer->add_control(new WP_Customize_Image_Control($customizer, 'kowboy_logo_dark', [
        'label' => 'Mörk logotyp',
        'description' => 'Visas på ljus bakgrund: i sidhuvudet på sidor utan hjältebild och i sidfoten.',
        'section' => 'kowboy_logo',
    ]));
    $customizer->add_control(new WP_Customize_Image_Control($customizer, 'kowboy_logo_bright', [
        'label' => 'Ljus logotyp',
        'description' => 'Visas över hjältebilden överst på sidan.',
        'section' => 'kowboy_logo',
    ]));

    $customizer->add_section('kowboy_typography', ['title' => 'Typografi', 'panel' => 'kowboy', 'description' => 'Huvudstilarna. Typsnittet är Manrope.']);
    $customizer->add_control('kowboy_display_size', ['label' => 'Rubrikstorlek (px)', 'section' => 'kowboy_typography', 'type' => 'number', 'input_attrs' => ['min' => 24, 'max' => 96]]);
    $customizer->add_control('kowboy_display_weight', ['label' => 'Rubrikvikt', 'section' => 'kowboy_typography', 'type' => 'select', 'choices' => [400 => 'Normal (400)', 500 => 'Medium (500)', 600 => 'Halvfet (600)', 700 => 'Fet (700)']]);
    $customizer->add_control('kowboy_body_size', ['label' => 'Brödtextstorlek (px)', 'section' => 'kowboy_typography', 'type' => 'number', 'input_attrs' => ['min' => 12, 'max' => 24]]);
    $customizer->add_control('kowboy_label_size', ['label' => 'Etikettstorlek (px)', 'section' => 'kowboy_typography', 'type' => 'number', 'input_attrs' => ['min' => 10, 'max' => 16]]);

    $customizer->add_section('kowboy_contact', ['title' => 'Kontakt', 'panel' => 'kowboy', 'description' => 'Visas i sidfoten.']);
    $customizer->add_control('kowboy_address', ['label' => 'Adress', 'section' => 'kowboy_contact', 'type' => 'text']);
    $customizer->add_control('kowboy_phone', ['label' => 'Telefon', 'section' => 'kowboy_contact', 'type' => 'text']);
    $customizer->add_control('kowboy_email', ['label' => 'E-post', 'section' => 'kowboy_contact', 'type' => 'email']);
    $customizer->add_control('kowboy_copyright', ['label' => 'Copyrightrad', 'section' => 'kowboy_contact', 'type' => 'text', 'description' => 'Årtalet läggs till automatiskt.']);

    $customizer->add_section('kowboy_forms', ['title' => 'Formulär', 'panel' => 'kowboy', 'description' => 'Formulären är ännu inte kopplade: vart en förfrågan går bestäms senare (fråga 105).']);
    $customizer->add_control('kowboy_privacy_page', ['label' => 'Integritetspolicy', 'section' => 'kowboy_forms', 'type' => 'dropdown-pages', 'description' => 'Sidan som samtyckesrutan länkar till.']);
});

/** Every option is a number, a page id or a short string; nothing else is stored. */
function kowboy_sanitize_option(mixed $value): mixed
{
    return is_numeric($value) ? (int) $value : sanitize_text_field((string) $value);
}

/** The typography options as CSS variables, printed with the stylesheet. */
function kowboy_typography_css(): string
{
    return sprintf(
        ':root{--k-display-size:%dpx;--k-display-weight:%d;--k-body-size:%dpx;--k-label-size:%dpx}',
        (int) kowboy_option('kowboy_display_size'),
        (int) kowboy_option('kowboy_display_weight'),
        (int) kowboy_option('kowboy_body_size'),
        (int) kowboy_option('kowboy_label_size'),
    );
}

/** The logotype for a background: an image when one is uploaded, else the site's name. */
function kowboy_logo(bool $bright): string
{
    $url = (string) kowboy_option($bright ? 'kowboy_logo_bright' : 'kowboy_logo_dark');
    $name = get_bloginfo('name');
    $inner = $url === ''
        ? '<span class="k-logo__name">' . esc_html($name) . '</span>'
        : '<img src="' . esc_url($url) . '" alt="' . esc_attr($name) . '" class="k-logo__image">';
    return '<a class="k-logo" href="' . esc_url(home_url('/')) . '" rel="home">' . $inner . '</a>';
}
