<?php
// One property card (the design's Property Card): the first three photos in a Swiper slider,
// the status pill (the next viewing when one is ahead, else the status as the CRM names it),
// the tenure, the street, and the price row. Every string is `display`'s or a value as sent.
// The whole card leads to the property; on a card with a slider the photos can be swiped and a
// plain click on them follows the link too (the script).
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
    isset($display['fee_amount']) ? 'Avgift ' . $display['fee_amount'] . '/mån' : null,
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
// The card is 3:4 and the photos are wider than tall, so the file the browser picks must be about twice the card's width to fill it.
$sizes = '(min-width: 1024px) 768px, (min-width: 640px) 100vw, 150vw';
?>
<article class="k-card<?php echo count($images) > 1 ? ' k-card--slider' : ''; ?>" data-card-url="<?php echo esc_url($url); ?>">
    <div class="k-card__media">
        <?php if (count($images) > 1) : ?>
            <div class="swiper k-card__slider" data-card-slider>
                <div class="swiper-wrapper">
                    <?php foreach ($images as $image) : ?>
                        <div class="swiper-slide"><?php echo kowboy_image($image, $sizes, $street, ['class' => 'k-card__image']); ?></div>
                    <?php endforeach; ?>
                </div>
                <div class="swiper-pagination k-card__dots"></div>
            </div>
        <?php elseif ($images !== []) : ?>
            <?php echo kowboy_image($images[0], $sizes, $street, ['class' => 'k-card__image']); ?>
        <?php endif; ?>
        <?php if ($label !== '') : ?><span class="k-card__status"><?php echo esc_html($label); ?></span><?php endif; ?>
    </div>
    <a class="k-card__link" href="<?php echo esc_url($url); ?>"><span class="k-visually-hidden"><?php echo esc_html($street); ?></span></a>
    <span class="k-card__body">
        <?php if (is_string($item['tenure']['name'] ?? null)) : ?><span class="k-card__tenure"><?php echo esc_html($item['tenure']['name']); ?></span><?php endif; ?>
        <span class="k-card__street"><?php echo esc_html($street); ?></span>
        <?php if ($facts !== []) : ?>
            <span class="k-card__facts"><?php foreach ($facts as $fact) : ?><span><?php echo esc_html((string) $fact); ?></span><?php endforeach; ?></span>
        <?php endif; ?>
    </span>
</article>
