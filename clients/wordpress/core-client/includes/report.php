<?php
// Error reporting through Core (question 46, Patric 2026-09-19): every report goes to the PHP error
// log as one line of JSON and, when the site is linked, to Core's POST /v1/errors, where the same
// bug on many sites becomes one report a day and no site holds a key of its own. A fatal error in
// this plugin's own files is reported the same way from PHP's shutdown, which still runs after one.

declare(strict_types=1);

/**
 * Report something the operator should know about. `where` names the place (a file and line, a
 * step); the rest of the context travels as detail. Never pass the token or the bell secret.
 *
 * @param array<string, mixed> $context
 */
function core_client_report(string $message, array $context = []): void
{
    error_log((string) wp_json_encode(['level' => 'error', 'source' => 'core-client', 'message' => $message] + $context));
    $settings = core_client_settings();
    if ($settings['url'] === '' || $settings['token'] === '') {
        return;
    }
    $where = (string) ($context['where'] ?? '');
    unset($context['where']);
    wp_remote_post($settings['url'] . '/v1/errors', [
        'timeout' => 2,
        'headers' => [
            'Authorization' => 'Bearer ' . $settings['token'],
            'Content-Type' => 'application/json',
            'X-Core-Client' => 'wordpress/' . CORE_CLIENT_VERSION,
            // Which site reports, as on a pull, so the error shows on this site's row in Core.
            'X-Core-Site' => rest_url('core/v1/bell'),
        ],
        'body' => wp_json_encode([
            'message' => $message,
            'where' => $where,
            'detail' => substr((string) wp_json_encode($context), 0, 4000),
        ]),
    ]);
}

register_shutdown_function(function (): void {
    $error = error_get_last();
    if ($error === null || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        return;
    }
    if (!str_starts_with((string) $error['file'], dirname(__DIR__))) {
        return; // Another plugin's or the theme's fatal: not ours to report.
    }
    core_client_report('fatal error', [
        'where' => basename($error['file']) . ':' . $error['line'],
        'detail' => $error['message'],
    ]);
});
