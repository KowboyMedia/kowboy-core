<?php
// An agent's page: the name and the agent's homes.
//
// In scope: $item.

declare(strict_types=1);

echo '<h1>' . esc_html((string) ($item['name'] ?? '')) . '</h1>';
echo core_client_list(['entity' => 'property', 'agent' => (string) ($item['id'] ?? ''), 'status' => 'for_sale,coming,sold', 'styleisolation' => false])['html'];
