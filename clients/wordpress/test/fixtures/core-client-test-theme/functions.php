<?php
// The test theme: a set of its own (the plugin's one line) and the page's title from WordPress.
// Its views under core/ show what the plugin hands them, in the fewest words a test can find a
// value by; they decide nothing and format nothing.

declare(strict_types=1);

add_action('after_setup_theme', function (): void {
    add_theme_support('title-tag');
});

if (function_exists('core_client_register_template_set')) {
    core_client_register_template_set('test-theme', 'Test theme', __FILE__, '0.1.0');
}
