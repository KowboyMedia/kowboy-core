<?php
// The property archive (/objekt/): the for-sale list, the statuses the site named as for sale and
// coming on its settings page; the visitor's filters come from the address, so a filtered page is
// crawlable and shareable.

declare(strict_types=1);

$params = array_merge(
    ['entity' => 'property', 'status' => 'for_sale,coming', 'status_filter' => '1', 'filters' => '1', 'per_page' => 10],
    array_intersect_key($_GET, array_flip(['status', 'max_price', 'min_living_space', 'min_rooms', 'area'])),
);
echo core_client_list($params)['html'];
