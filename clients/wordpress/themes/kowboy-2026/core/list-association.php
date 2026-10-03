<?php
// The association list wrapper: a title and the cards, three a row like the areas'.
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="k-list k-list--areas k-list--associations"><div class="k-container">
    <?php if (($params['title'] ?? '') !== '') : ?><h2 class="k-section__title"><?php echo esc_html((string) $params['title']); ?></h2><?php endif; ?>
    <?php if ($result['total'] === 0) : ?><p class="k-list__empty">Inga föreningar ännu.</p><?php endif; ?>
    <div class="k-cards"><?php echo $cards; ?></div>
</div></div>
