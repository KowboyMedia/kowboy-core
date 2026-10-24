<?php
// An office's page: the name, the address line and the office's agents.
//
// In scope: $item.

declare(strict_types=1);

echo '<h1>' . esc_html((string) ($item['name'] ?? '')) . '</h1>';
echo '<p class="t-address">' . esc_html((string) ($item['display']['address_line'] ?? '')) . '</p>';
echo core_client_list(['entity' => 'agent', 'office' => (string) ($item['id'] ?? ''), 'per_page' => 100, 'styleisolation' => false])['html'];
