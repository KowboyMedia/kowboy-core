<?php
// Error reporting placeholder, the same shape as Core's: one line of JSON in the PHP error log
// until a Sentry DSN exists. When it does, this one file changes.

declare(strict_types=1);

/**
 * Report something the operator should know about. Never pass the token or the bell secret.
 *
 * @param array<string, mixed> $context
 */
function core_client_report(string $message, array $context = []): void
{
    error_log((string) wp_json_encode(['level' => 'error', 'source' => 'core-client', 'message' => $message] + $context));
}
