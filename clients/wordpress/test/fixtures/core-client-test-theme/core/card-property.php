<?php
// A home's card: its street linked to its page, its area's name, and its price and living space
// as Core's display strings.
//
// In scope: $post_id, $item.

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
?>
<article class="t-card"><a href="<?php echo esc_url((string) get_permalink($post_id)); ?>"><span class="t-card__street"><?php echo esc_html((string) ($item['address']['street'] ?? '')); ?></span></a> <span class="t-card__area"><?php echo esc_html((string) ($item['address']['area_name'] ?? '')); ?></span> <span class="t-card__price"><?php echo esc_html((string) ($display['final_price'] ?? $display['price'] ?? '')); ?></span> <span class="t-card__size"><?php echo esc_html((string) ($display['living_space'] ?? '')); ?></span></article>
