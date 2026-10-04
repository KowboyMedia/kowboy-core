<?php
// The property archive (/objekt/): the for-sale list with the status tabs; the visitor's filters
// come from the address, so a filtered page is crawlable and shareable. The archive's own setting
// stands over the address (as the plugin's block does), so the box offers the places of the
// homes every tab can show.

declare(strict_types=1);

$params = ['entity' => 'property', 'status' => 'for_sale,coming', 'status_filter' => '1', 'filters' => '1', 'place_search' => 'places', 'per_page' => 9, 'title' => 'Till salu']
    + array_intersect_key($_GET, array_flip(['max_price', 'min_living_space', 'min_rooms', 'q', 'area', 'lkf', 'areas', 'tags']));
echo '<div class="k-page-top"></div>' . core_client_list($params + ['shadow' => false])['html'];
