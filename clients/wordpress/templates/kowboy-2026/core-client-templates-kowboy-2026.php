<?php
/**
 * Plugin Name: Kowboy Core templates: Kowboy 2026
 * Plugin URI: https://kowboy.se/core-client-templates-kowboy-2026
 * Description: The default template set "Kowboy 2026" for the Kowboy Core client: the cards, lists and single pages, showing what Core delivers.
 * Version: 0.1.0
 * Requires at least: 6.8
 * Requires PHP: 8.2
 * Requires Plugins: core-client
 * Author: Kowboy Media
 * Update URI: https://kowboy.se/core-client-templates-kowboy-2026
 */

// One file per view (docs/default-templates.md, "The scaffolding"): single-core_<datatype>.php for
// the single pages, list-<entity>.php for the list wrappers, card-<entity>.php for the cards,
// archive-core_<datatype>.php of a few lines for the archives. Every view is a PHP block on top
// that prepares the values and plain markup below. The markup, the stylesheet and the behaviours
// come from the "kowboy-templates-v2-v3" package (its 2025 template), on Patric's word of
// 2026-09-28; the sync plugin (core-client) finds the files, theme copies first, and serves the
// list function. The package's stylesheet is written for a shadow root, so the set asks for one
// until the site decides otherwise.

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const KOWBOY_2026_VERSION = '0.1.0';
const KOWBOY_2026_NEEDS_CLIENT = '0.2.0';

add_action('plugins_loaded', function (): void {
    if (!function_exists('core_client_register_template_set') || version_compare(CORE_CLIENT_VERSION, KOWBOY_2026_NEEDS_CLIENT, '<')) {
        add_action('admin_notices', function (): void {
            echo '<div class="notice notice-error"><p><strong>Kowboy 2026:</strong> this template set needs Kowboy Core Client '
                . esc_html(KOWBOY_2026_NEEDS_CLIENT) . ' or later. Update the client plugin.</p></div>';
        });
        return;
    }
    core_client_register_template_set('kowboy-2026', 'Kowboy 2026', __FILE__, KOWBOY_2026_VERSION, true);
});

// The package's typeface, Manrope, served by Google Fonts on the page (a font declared inside a
// shadow root does not load), with the weights the stylesheet uses.
add_action('wp_enqueue_scripts', function (): void {
    if (function_exists('core_client_template_set') && (core_client_template_set()['slug'] ?? null) === 'kowboy-2026') {
        wp_enqueue_style('kowboy-2026-font', 'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap', [], null);
    }
});
