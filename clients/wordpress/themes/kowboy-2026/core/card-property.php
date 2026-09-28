<?php
// One property card (the design's Property Card): the first three photos in a Swiper slider,
// the status pill (the next viewing when one is ahead, else the status as the CRM names it),
// the tenure, the street, and the price row. Every string is `display`'s or a value as sent.
//
// In scope: $post_id, $item (the record as Core delivered it), $params (the list's parameter set).

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$url = get_permalink($post_id);
$street = (string) ($item['address']['street'] ?? '');
$images = array_slice(array_values(array_filter(is_array($item['images'] ?? null) ? $item['images'] : [], fn (array $image): bool => ($image['category'] ?? null) !== 'Planritning')), 0, 3);
$sold = isset($display['final_price']);
$facts = array_filter([
    $display['final_price'] ?? $display['price'] ?? null,
    $display['rooms'] ?? null,
    $display['living_space'] ?? null,
    isset($display['fee_amount']) ? 'Avgift ' . $display['fee_amount'] : null,
]);
$label = (string) ($item['status']['name'] ?? '');
$next_viewing = null;
foreach (is_array($item['viewings'] ?? null) ? $item['viewings'] : [] as $viewing) {
    $starts = is_string($viewing['starts_at'] ?? null) ? strtotime($viewing['starts_at']) : false;
    if ($starts !== false && $starts >= time() && ($next_viewing === null || $starts < $next_viewing)) {
        $next_viewing = $starts;
    }
}
if (!$sold && $next_viewing !== null) {
    $label = 'Visning ' . wp_date('D j M H:i', $next_viewing);
}
?>
<article class="k-card">
    <div class="k-card__media">
        <?php if (count($images) > 1) : ?>
            <div class="swiper k-card__slider" data-card-slider>
                <div class="swiper-wrapper">
                    <?php foreach ($images as $image) : ?>
                        <div class="swiper-slide"><?php echo kowboy_image($image, '(min-width: 1024px) 384px, 100vw', $street, ['class' => 'k-card__image']); ?></div>
                    <?php endforeach; ?>
                </div>
                <div class="swiper-pagination k-card__dots"></div>
            </div>
        <?php elseif ($images !== []) : ?>
            <?php echo kowboy_image($images[0], '(min-width: 1024px) 384px, 100vw', $street, ['class' => 'k-card__image']); ?>
        <?php endif; ?>
        <?php if ($label !== '') : ?><span class="k-card__status"><?php echo esc_html($label); ?></span><?php endif; ?>
    </div>
    <a class="k-card__link" href="<?php echo esc_url($url); ?>">
        <span class="k-card__body">
            <?php if (is_string($item['tenure']['name'] ?? null)) : ?><span class="k-card__tenure"><?php echo esc_html($item['tenure']['name']); ?></span><?php endif; ?>
            <span class="k-card__street"><?php echo esc_html($street); ?></span>
            <?php if ($facts !== []) : ?>
                <span class="k-card__facts"><?php foreach ($facts as $fact) : ?><span><?php echo esc_html((string) $fact); ?></span><?php endforeach; ?></span>
            <?php endif; ?>
        </span>
    </a>
</article>
