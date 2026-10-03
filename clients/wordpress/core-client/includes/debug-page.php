<?php
// The `?debugpl` answer (includes/debug.php): the record's `item` and `raw` as one JSON document,
// plain text under the JSON media type, nothing of the theme around it (Patric, 2026-10-03).

declare(strict_types=1);

$core_client_post_id = (int) get_the_ID();
nocache_headers();
header('Content-Type: application/json; charset=utf-8');
echo wp_json_encode([
    'item' => core_client_item($core_client_post_id),
    'raw' => core_client_item_raw($core_client_post_id),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
exit;
