<?php
// The fixture set's archive: the list, nothing else.

declare(strict_types=1);

echo core_client_list(['entity' => 'property', 'status' => 'for_sale,coming', 'per_page' => 9])['html'];
