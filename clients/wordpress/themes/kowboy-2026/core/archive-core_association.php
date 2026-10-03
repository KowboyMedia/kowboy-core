<?php
// The associations archive (/forening/): every association of the site, as cards like the areas' (Patric, 2026-10-03).

declare(strict_types=1);

echo '<div class="k-page-top"></div>' . core_client_list(['entity' => 'association', 'per_page' => 100, 'title' => 'Föreningar', 'shadow' => false])['html'];
