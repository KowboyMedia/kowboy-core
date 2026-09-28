<?php
// The agent list wrapper: a title and the cards, four a row.

declare(strict_types=1);
?>
<div class="k-agents"><div class="k-container">
    <?php if (($params['title'] ?? '') !== '') : ?><h2 class="k-section__title"><?php echo esc_html((string) $params['title']); ?></h2><?php endif; ?>
    <div class="k-agents__grid"><?php echo $cards; ?></div>
</div></div>
