<?php
// The property archive (/objekt/): the for-sale list with the status tabs; the visitor's filters
// come from the address, so a filtered page is crawlable and shareable.

declare(strict_types=1);

$params = array_merge(
    ['entity' => 'property', 'status' => 'for_sale,coming', 'status_filter' => '1', 'filters' => '1', 'per_page' => 9, 'title' => 'Till salu'],
    array_intersect_key($_GET, array_flip(['status', 'max_price', 'min_living_space', 'min_rooms', 'area'])),
);
echo '<div class="k-page-top"></div>' . core_client_list($params + ['shadow' => false])['html'];
