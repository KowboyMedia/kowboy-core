<?php
// An area's page: the hero (the area's pictures, else its listings' photos, else every
// listing's, as the home page's), its pictures in the same gallery as a property's, the texts
// about it in the same accordion, its outline on a map, and the properties in it; nothing at
// all when it has none (Patric, 2026-10-03).
//
// In scope: $post_id, $item, $raw.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$area_id = (string) ($item['id'] ?? '');
$polygon = is_array($item['polygon'] ?? null) ? $item['polygon'] : [];
$pictures = array_values(array_filter(is_array($item['images'] ?? null) ? $item['images'] : [], 'is_array'));
$images = array_map(fn (array $image): string => (string) ($image['url'] ?? ''), array_slice($pictures, 0, 5));
$texts = array_filter([
    'Läge' => $item['surroundings']['area'] ?? null,
    'Kommunikation' => $item['surroundings']['communication'] ?? null,
    'Skolor och service' => $item['surroundings']['service'] ?? null,
    'Parkering' => $item['surroundings']['parking'] ?? null,
    'Övrigt' => $item['surroundings']['other'] ?? null,
], fn (mixed $value): bool => is_string($value) && $value !== '');
$properties = core_client_list(['entity' => 'property', 'area_id' => $area_id, 'status' => 'for_sale,coming,sold', 'status_filter' => '1', 'per_page' => 9, 'title' => 'Bostäder i ' . $name, 'shadow' => false]);
$hero_content = '<div class="k-hero__head"><div class="k-hero__head-main"><h1 class="k-hero__title k-hero__title--left">' . esc_html($name) . '</h1></div></div>';
echo kowboy_hero(kowboy_hero_media([], $images), $hero_content, ['variant' => 'property', 'alt' => $name, 'wrapper' => 'class="k-hero k-hero--property k-hero--area"', 'fallback' => ['area_id' => $area_id]]);
?>
<?php if ($pictures !== []) : ?><div class="k-area__gallery"><?php echo kowboy_part('gallery', ['photos' => $pictures, 'alt' => $name]); ?></div><?php endif; ?>
<?php if ($texts !== []) : ?>
    <section class="k-area k-area--page">
        <div class="k-container"><?php echo kowboy_part('accordion', ['items' => kowboy_text_items($texts)]); ?></div>
    </section>
<?php endif; ?>
<?php if ($polygon !== []) : ?><div class="k-map k-map--area" data-map data-polygon="<?php echo esc_attr((string) wp_json_encode($polygon)); ?>" data-title="<?php echo esc_attr($name); ?>"></div><?php endif; ?>
<?php if ($properties['total'] > 0) : ?><div class="k-area__list"><?php echo $properties['html']; ?></div><?php endif; ?>
