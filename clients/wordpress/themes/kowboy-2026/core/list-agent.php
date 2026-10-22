<?php
// The agent list wrapper: a title and the cards, four a row, and "Visa fler" when there are more.
// The script refreshes the cards once on load (core_client_list_data).
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="k-agents" <?php echo core_client_list_data($params, $result); ?>><div class="k-container">
    <?php if (($params['title'] ?? '') !== '') : ?><h2 class="k-section__title"><?php echo esc_html((string) $params['title']); ?></h2><?php endif; ?>
    <div class="k-agents__grid" data-cards><?php echo $cards; ?></div>
    <?php echo kowboy_part('more', ['result' => $result]); ?>
</div></div>
