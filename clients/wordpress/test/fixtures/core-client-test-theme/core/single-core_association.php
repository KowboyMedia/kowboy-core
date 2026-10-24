<?php
// An association's page: the name and the homes in the association.
//
// In scope: $item.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
echo '<h1>' . esc_html($name) . '</h1><h2>Bostäder i ' . esc_html($name) . '</h2>';
echo core_client_list(['entity' => 'property', 'association' => (string) ($item['id'] ?? ''), 'status' => 'for_sale,coming,sold', 'styleisolation' => false])['html'];
