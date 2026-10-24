<?php
// The area archive, paged by WordPress's own /page/N/, so the list names its page.

declare(strict_types=1);

echo '<h1>Områden</h1>' . core_client_list(['entity' => 'area', 'per_page' => 12, 'page' => max(1, (int) get_query_var('paged')), 'styleisolation' => false])['html'];
