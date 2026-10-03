<?php
// One accordion (the design's collapsible sections): a heading button per item and a panel that
// opens with an animation (the script toggles `is-open`, the stylesheet animates the height).
// The fact tables, the area texts and an area's page are this part with different items.
//
// In scope: $items (a list of ['label' => string, 'html' => string]).

declare(strict_types=1);
?>
<div class="k-accordion" data-accordion>
    <?php foreach ($items as $item) : ?>
        <div class="k-accordion__item">
            <h3 class="k-accordion__heading"><button class="k-accordion__button" type="button" aria-expanded="false" data-accordion-button><?php echo esc_html((string) $item['label']); ?><span class="k-accordion__chevron" aria-hidden="true"></span></button></h3>
            <div class="k-accordion__panel"><div class="k-accordion__inner"><?php echo $item['html']; ?></div></div>
        </div>
    <?php endforeach; ?>
</div>
