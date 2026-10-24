<?php
// A live part of a page: a list of the page's own record with a card that renders the part, so
// the browser refreshes it like every list.
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="t-live" <?php echo core_client_list_data($params, $result); ?>><div data-cards><?php echo $cards; ?></div></div>
