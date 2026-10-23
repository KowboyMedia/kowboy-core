<?php
// A live part of a page (Patric, 231 a): what a page shows from other records (a home's agents,
// its association, its area) is a list of the page's own record with a card that renders the
// part, so it is rendered on the server and refreshed in the browser like every list, and a kept
// page never shows another record as it was. The wrapper adds no box of its own (the stylesheet,
// `.k-live`): the card's markup stands where the page puts the part.
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="k-live" <?php echo core_client_list_data($params, $result); ?>><div class="k-live__cards" data-cards><?php echo $cards; ?></div></div>
