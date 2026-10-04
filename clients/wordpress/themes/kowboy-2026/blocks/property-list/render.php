<?php
// The property list block: the plugin's one list function with the theme's list wrapper and cards.

declare(strict_types=1);

if (!function_exists('core_client_list')) {
    return;
}
$params = [
    'entity' => 'property',
    'status' => (string) ($attributes['status'] ?? 'for_sale,coming'),
    'per_page' => max(1, (int) ($attributes['perPage'] ?? 9)),
    'status_filter' => !empty($attributes['statusTabs']) ? '1' : '',
    'filters' => !empty($attributes['filters']) ? '1' : '',
    'title' => (string) ($attributes['title'] ?? ''),
    'lead' => (string) ($attributes['lead'] ?? ''),
    'shadow' => false,
];
$params += array_intersect_key($_GET, array_flip(['status', 'max_price', 'min_living_space', 'min_rooms', 'q', 'area', 'lkf', 'areas']));
echo kowboy_section_open('k-list-section' . (($attributes['background'] ?? 'white') === 'subtle' ? ' k-list-section--subtle' : ''));
echo core_client_list($params)['html'];
echo '</section>';
