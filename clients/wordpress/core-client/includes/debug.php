<?php
// `?debugpl` on any record's page (Patric, 2026-10-03): the record's JSON as the local copy
// holds it, as plain JSON the browser shows itself, so a template's author sees what `display`
// and `data` carry without reading the database. The universal record (`item`) and the CRM's
// payload (`raw`) in one document. For signed-in users who may edit the site, since the payload may hold what the
// page does not show.

declare(strict_types=1);

add_filter('template_include', function (string $template): string {
    if (!isset($_GET['debugpl']) || !is_singular() || !str_starts_with((string) get_post_type(), 'core_') || !current_user_can('edit_posts')) {
        return $template;
    }
    return __DIR__ . '/debug-page.php';
}, 20);
