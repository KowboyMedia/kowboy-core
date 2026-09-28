<?php
// The agent list wrapper, the package's markup: a grid of agent cards. No filters, no reload.
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="template-2025-container">
    <div class="max-w-[1240px] mx-auto px-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-7 agents-list"><?php echo $cards; ?></div>
    </div>
</div>
