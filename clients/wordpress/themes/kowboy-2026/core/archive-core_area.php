<?php
// The areas archive (/omrade/): every area of the site, as cards like the properties' (Patric, 2026-10-03).

declare(strict_types=1);

echo '<div class="k-page-top"></div>' . core_client_list(['entity' => 'area', 'per_page' => KOWBOY_ARCHIVE_PER_PAGE, 'page' => max(1, (int) get_query_var('paged')), 'title' => 'Områden', 'shadow' => false])['html'];
