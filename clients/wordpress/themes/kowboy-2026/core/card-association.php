<?php
// One association as a card, in the area card's shape: the theme's placeholder (an association
// carries no pictures), the name, and how many of its homes are for sale.
//
// In scope: $post_id, $item (the association record), $params.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$url = get_permalink($post_id);
$for_sale = function_exists('core_client_query') ? (int) core_client_query(['entity' => 'property', 'association' => (string) ($item['id'] ?? ''), 'status' => 'for_sale', 'per_page' => 1])['total'] : 0;
?>
<article class="k-card k-card--area k-card--association" data-card-url="<?php echo esc_url($url); ?>">
    <div class="k-card__media">
        <img class="k-card__image k-card__image--placeholder" src="<?php echo esc_url(get_theme_file_uri('assets/placeholder.svg')); ?>" alt="" loading="lazy">
    </div>
    <a class="k-card__link" href="<?php echo esc_url($url); ?>"><span class="k-visually-hidden"><?php echo esc_html($name); ?></span></a>
    <span class="k-card__body">
        <span class="k-card__area">Förening</span>
        <span class="k-card__street"><?php echo esc_html($name); ?></span>
        <?php if ($for_sale > 0) : ?><span class="k-card__facts"><span><?php echo esc_html($for_sale === 1 ? '1 bostad till salu' : $for_sale . ' bostäder till salu'); ?></span></span><?php endif; ?>
    </span>
</article>
