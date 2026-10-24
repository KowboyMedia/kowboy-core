<?php
// The property archive: the for-sale list with its filters and the place search box, the
// visitor's choices read from the address, so a filtered page can be shared and drawn again.

declare(strict_types=1);

$params = ['entity' => 'property', 'status' => 'for_sale,coming', 'filters' => '1', 'place_search' => 'places', 'per_page' => 9]
    + array_intersect_key($_GET, array_flip(['max_price', 'min_living_space', 'min_rooms', 'q', 'area', 'lkf', 'areas', 'tags']));
echo '<h1>Till salu</h1>' . core_client_list($params + ['styleisolation' => false])['html'];
