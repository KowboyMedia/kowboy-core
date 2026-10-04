<?php
// One area as a card, in the property card's shape: the area's first picture, else the theme's
// placeholder (assets/placeholder.svg), the kommun, the name, and how many homes are for sale there.
//
// In scope: $post_id, $item (the area record), $params.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$url = get_permalink($post_id);
$image = is_array($item['images'][0] ?? null) ? $item['images'][0] : null;
$for_sale = function_exists('core_client_query') ? (int) core_client_query(['entity' => 'property', 'area_id' => (string) ($item['id'] ?? ''), 'status' => 'for_sale', 'per_page' => 1])['total'] : 0;
$sizes = '(min-width: 1024px) 768px, (min-width: 640px) 100vw, 150vw';
// The kommun over the name, from the area's LKF code, as on the area's page (Patric, 2026-10-04); "Område" when the code names none.
$municipality = function_exists('core_client_municipality_name') ? core_client_municipality_name(is_string($item['county_municipality_code'] ?? null) ? $item['county_municipality_code'] : null) : null;
?>
<article class="k-card k-card--area" data-card-url="<?php echo esc_url($url); ?>">
    <div class="k-card__media">
        <?php echo $image === null
            ? '<img class="k-card__image k-card__image--placeholder" src="' . esc_url(get_theme_file_uri('assets/placeholder.svg')) . '" alt="" loading="lazy">'
            : kowboy_image($image, $sizes, $name, ['class' => 'k-card__image']); ?>
    </div>
    <a class="k-card__link" href="<?php echo esc_url($url); ?>"><span class="k-visually-hidden"><?php echo esc_html($name); ?></span></a>
    <span class="k-card__body">
        <span class="k-card__area"><?php echo esc_html($municipality ?? 'Område'); ?></span>
        <span class="k-card__street"><?php echo esc_html($name); ?></span>
        <?php if ($for_sale > 0) : ?><span class="k-card__facts"><span><?php echo esc_html($for_sale === 1 ? '1 bostad till salu' : $for_sale . ' bostäder till salu'); ?></span></span><?php endif; ?>
    </span>
</article>
