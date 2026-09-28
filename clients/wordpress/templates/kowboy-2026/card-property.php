<?php
// One property card, the package's markup: the first three images in a slider, the label (the
// next viewing when one is ahead, else the status as the CRM names it), the street, the price
// and one line of facts. Every string comes from `display` or is a value shown as sent; the
// viewing's date follows the site's own settings.
//
// In scope: $post_id, $item (the record as Core delivered it), $params (the list's parameter set).

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$url = get_permalink($post_id);
$street = (string) ($item['address']['street'] ?? '');
$images = array_slice(is_array($item['images'] ?? null) ? $item['images'] : [], 0, 3);
$sold = isset($display['final_price']);
$price = $display['final_price'] ?? $display['price'] ?? null;
$facts = array_filter([
    $item['tenure']['name'] ?? null,
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
if ($next_viewing !== null) {
    $label = 'Visning ' . wp_date('D d M \k\l H:i', $next_viewing);
}
?>
<div class="w-full bg-white shadow-lg rounded-lg overflow-hidden">
    <div class="relative">
        <?php if ($label !== '') : ?><span class="sold_label"><?php echo esc_html($label); ?></span><?php endif; ?>
        <?php if ($images !== []) : ?>
            <div class="swiper overflow-hidden property-list-gallery rounded-none">
                <div class="swiper-wrapper">
                    <?php foreach ($images as $image) : ?>
                        <div class="swiper-slide">
                            <div class="w-full">
                                <a href="<?php echo esc_url($url); ?>" class="flex">
                                    <img src="<?php echo esc_url((string) $image['url']); ?>" class="w-full object-cover" style="height: 16rem;" alt="<?php echo esc_attr($street); ?>" loading="lazy">
                                </a>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>
                <div class="swiper-pagination"></div>
            </div>
        <?php endif; ?>
    </div>
    <div class="p-4">
        <div class="flex justify-between items-end mb-2">
            <a class="<?php echo $sold ? 'sold_property ' : ''; ?>no-underline" href="<?php echo esc_url($url); ?>">
                <h3 class="text-black text-[18px] md:text-[24px] leading-none md:leading-[1.5] font-semibold m-0"><?php echo esc_html($street); ?></h3>
            </a>
            <span class="text-[16px] md:!text-[20px] leading-none md:leading-[1.5] text-gray-700 font-medium"><?php echo $price === null ? '' : esc_html($price); ?></span>
        </div>
        <div class="h[1px] bg-gray-300 mb-3"></div>
        <?php if ($facts !== []) : ?>
            <ul class="p-0 list-none flex flex-wrap justify-between md:!justify-start gap-x-4 text-[14px] md:text-[16px] text-gray-600 mb-2">
                <?php foreach ($facts as $fact) : ?><li><?php echo esc_html((string) $fact); ?></li><?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </div>
</div>
