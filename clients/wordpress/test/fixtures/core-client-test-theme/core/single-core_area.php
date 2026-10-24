<?php
// An area's page: the name and the homes in the area.
//
// In scope: $item.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
echo '<h1>' . esc_html($name) . '</h1><h2>Bostäder i ' . esc_html($name) . '</h2>';
echo core_client_list(['entity' => 'property', 'area_id' => (string) ($item['id'] ?? ''), 'status' => 'for_sale,coming,sold', 'styleisolation' => false])['html'];
