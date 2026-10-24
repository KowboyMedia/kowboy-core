<?php
// A list of areas.
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="t-list" <?php echo core_client_list_data($params, $result); ?>><div class="t-cards" data-cards><?php echo $cards; ?></div></div>
