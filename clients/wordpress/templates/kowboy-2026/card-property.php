<?php
// One property card: the first images, the label (the next viewing when one is ahead, else the
// status as the CRM names it), the street, the price, and one line of facts. Every string comes
// from `display` or is a value shown as sent; the viewing's date follows the site's own settings.
//
// In scope: $post_id, $item (the record as Core delivered it), $params (the list's parameter set).

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$url = get_permalink($post_id);
$street = (string) ($item['address']['street'] ?? '');
$images = array_slice(is_array($item['images'] ?? null) ? $item['images'] : [], 0, 3);
$price = $display['final_price'] ?? $display['price'] ?? null;
$facts = array_filter([
    $item['tenure']['name'] ?? null,
    $display['rooms'] ?? null,
    $display['living_space'] ?? null,
    isset($display['fee']) ? 'Avgift ' . $display['fee'] : null,
]);

$label = (string) ($item['status']['name'] ?? '');
$next_viewing = null;
foreach (is_array($item['viewings'] ?? null) ? $item['viewings'] : [] as $viewing) {
    $starts = is_string($viewing['starts_at'] ?? null) ? strtotime($viewing['starts_at']) : false;
    if ($starts !== false && $starts >= time() && ($next_viewing === null || $starts < $next_viewing)) {
        $next_viewing = $starts;
    }
}
if ($next_viewing !== null) {
    $label = 'Visning ' . wp_date('D d M \k\l H:i', $next_viewing);
}
?>
<article class="k26-card">
    <div class="k26-card__media">
        <?php if ($label !== '') : ?><span class="k26-label"><?php echo esc_html($label); ?></span><?php endif; ?>
        <div class="k26-slider" data-slider>
            <?php foreach ($images as $index => $image) : ?>
                <a href="<?php echo esc_url($url); ?>" class="k26-slider__slide<?php echo $index === 0 ? ' is-active' : ''; ?>">
                    <img src="<?php echo esc_url((string) $image['url']); ?>" alt="<?php echo esc_attr($street); ?>" loading="lazy">
                </a>
            <?php endforeach; ?>
            <?php if (count($images) > 1) : ?>
                <button type="button" class="k26-slider__prev" aria-label="Föregående bild"></button>
                <button type="button" class="k26-slider__next" aria-label="Nästa bild"></button>
            <?php endif; ?>
        </div>
    </div>
    <div class="k26-card__body">
        <div class="k26-card__heading">
            <a href="<?php echo esc_url($url); ?>"><h3><?php echo esc_html($street); ?></h3></a>
            <?php if ($price !== null) : ?><span class="k26-card__price"><?php echo esc_html($price); ?></span><?php endif; ?>
        </div>
        <?php if ($facts !== []) : ?>
            <ul class="k26-card__facts">
                <?php foreach ($facts as $fact) : ?><li><?php echo esc_html((string) $fact); ?></li><?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </div>
</article>
