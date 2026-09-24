<?php
// The agent archive (/maklare/): every agent of the site, as cards.

declare(strict_types=1);

echo core_client_list(['entity' => 'agent', 'per_page' => 100])['html'];
