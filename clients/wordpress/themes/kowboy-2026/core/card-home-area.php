<?php
// A home's area under its page, a live part (core/list-part.php): the area's name, two of its
// pictures and the texts, the home's own texts first and the area's where the home has none
// (the five the CRM carries). A live part, since the area is another record.
//
// In scope: $post_id, $item (the home), $params.

declare(strict_types=1);

$area = core_client_items('area', is_array($item['area_ids'] ?? null) ? $item['area_ids'] : [])[0]['item'] ?? null;
$area_texts = array_filter([
    'Läge' => $item['surroundings']['area'] ?? ($area['surroundings']['area'] ?? null),
    'Kommunikation' => $item['surroundings']['communication'] ?? ($area['surroundings']['communication'] ?? null),
    'Skolor och service' => $item['surroundings']['service'] ?? ($area['surroundings']['service'] ?? null),
    'Parkering' => $item['surroundings']['parking'] ?? ($area['surroundings']['parking'] ?? null),
    'Övrigt' => $item['surroundings']['other'] ?? ($area['surroundings']['other'] ?? null),
], fn (mixed $value): bool => is_string($value) && $value !== '');
$area_images = array_slice(is_array($area['images'] ?? null) ? $area['images'] : [], 0, 2);
if ($area_texts === [] && $area_images === []) {
    return;
}
?>
<section class="k-area">
    <div class="k-container">
        <h2 class="k-section__title"><?php echo esc_html(is_string($area['name'] ?? null) && $area['name'] !== '' ? $area['name'] : 'Område'); ?></h2>
        <?php if ($area_images !== []) : ?>
            <div class="k-area__images"><?php foreach ($area_images as $image) : ?><figure><?php echo kowboy_image($image, '(min-width: 1024px) 588px, 100vw', (string) ($area['name'] ?? '')); ?></figure><?php endforeach; ?></div>
        <?php endif; ?>
        <?php if ($area_texts !== []) : ?><?php echo kowboy_part('accordion', ['items' => kowboy_text_items($area_texts)]); ?><?php endif; ?>
    </div>
</section>
