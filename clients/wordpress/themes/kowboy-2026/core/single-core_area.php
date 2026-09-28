<?php
// An area's page: its name and pictures, the texts about it, and the properties in it.
//
// In scope: $post_id, $item, $raw.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$area_id = (string) ($item['id'] ?? '');
$images = array_slice(is_array($item['images'] ?? null) ? $item['images'] : [], 0, 2);
$texts = array_filter([
    'Läge' => $item['surroundings']['area'] ?? null,
    'Kommunikation' => $item['surroundings']['communication'] ?? null,
    'Skolor och service' => $item['surroundings']['service'] ?? null,
    'Parkering' => $item['surroundings']['parking'] ?? null,
    'Övrigt' => $item['surroundings']['other'] ?? null,
], fn (mixed $value): bool => is_string($value) && $value !== '');
$properties = core_client_list(['entity' => 'property', 'area_id' => $area_id, 'status' => 'for_sale,coming,sold', 'per_page' => 9, 'title' => 'Bostäder i ' . $name, 'shadow' => false]);
?>
<div class="k-page-top"></div>
<section class="k-area k-area--page">
    <div class="k-container">
        <h1 class="k-section__title"><?php echo esc_html($name); ?></h1>
        <?php if ($images !== []) : ?><div class="k-area__images"><?php foreach ($images as $image) : ?><figure><?php echo kowboy_image($image, '(min-width: 1024px) 588px, 100vw', $name); ?></figure><?php endforeach; ?></div><?php endif; ?>
        <?php if ($texts !== []) : ?>
            <div class="k-accordion" data-accordion>
                <?php foreach ($texts as $label => $value) : ?>
                    <div class="k-accordion__item">
                        <h3 class="k-accordion__heading"><button class="k-accordion__button" type="button" aria-expanded="false" data-accordion-button><?php echo esc_html((string) $label); ?><span class="k-accordion__chevron" aria-hidden="true"></span></button></h3>
                        <div class="k-accordion__panel" hidden><div class="k-prose"><?php echo wp_kses_post(wpautop(esc_html((string) $value))); ?></div></div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
</section>
<?php if ($properties['total'] > 0) : ?><?php echo $properties['html']; ?><?php endif; ?>
