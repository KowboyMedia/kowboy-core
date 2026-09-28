<?php
// An office page, the package's markup: the banner, the card with the office's description and
// contact (e-mail, phone, address), the map, the office's agents and its properties, both as
// lists inside this view.
//
// In scope: $post_id, $item, $raw.

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$name = (string) ($item['name'] ?? '');
$description = (string) ($item['description'] ?? '');
$email = is_string($item['email'] ?? null) ? $item['email'] : null;
$address = $display['address_line'] ?? null;
$phone = is_array($item['phone'] ?? null) ? $item['phone'] : null;
$lat = $item['lat'] ?? null;
$lng = $item['lng'] ?? null;
$office_id = (string) ($item['id'] ?? '');
$agents = core_client_list(['entity' => 'agent', 'office' => $office_id, 'per_page' => 100, 'shadow' => false, 'part' => 'cards']);
$properties_params = ['entity' => 'property', 'office' => $office_id, 'status' => 'for_sale,coming', 'per_page' => 6];
$properties = core_client_list($properties_params + ['part' => 'cards']);
?>
<div class="template-2025-container">
<section class="relative h-screen overflow-hidden area-banner mb-20">
    <div class="absolute inset-0 z-0 animate-kenburns area-banner-img area-banner-img--plain"></div>
    <div class="absolute inset-0 bg-black bg-opacity-50 z-10 area-banner-overlay"></div>
    <div class="absolute bottom-0 top-0 left-0 right-0 z-20 text-white p-6 flex items-center area-banner-content">
        <div class="max-w-[1200px] mx-auto area-banner-container flex-1">
            <div class="text-center"><h1 class="lg:text-6xl text-4xl font-bold area-banner-title mb-8"><?php echo esc_html($name); ?></h1></div>
        </div>
    </div>
</section>

<section class="single-area-section">
    <div class="max-w-[1200px] mx-auto">
        <div class="single-area-card p-10 md:p-20 bg-stone-100">
            <div class="border-b border-gray-300 pb-10 mb-10"><h2 class="single-area-title text-3xl md:text-4xl font-bold">Experter på <?php echo esc_html($name); ?></h2></div>
            <div class="space-y-8">
                <?php if ($description !== '') : ?><div class="single-area-description text-base space-y-4"><?php echo nl2br(esc_html($description)); ?></div><?php endif; ?>
                <div class="single-area-contacts flex flex-col md:flex-row gap-10">
                    <?php if ($email !== null) : ?>
                        <div class="border-b border-gray-300 pb-5 flex-1"><h3 class="text-xl md:text-2xl font-bold mb-1">E-post</h3><a href="mailto:<?php echo esc_attr($email); ?>" class="text-primary hover:underline break-all"><?php echo esc_html($email); ?></a></div>
                    <?php endif; ?>
                    <?php if (is_array($phone) && is_string($phone['display'] ?? null)) : ?>
                        <div class="border-b border-gray-300 pb-5 flex-1"><h3 class="text-xl md:text-2xl font-bold mb-1">Telefon:</h3><a href="tel:<?php echo esc_attr((string) ($phone['number'] ?? '')); ?>" class="text-primary hover:underline"><?php echo esc_html($phone['display']); ?></a></div>
                    <?php endif; ?>
                    <?php if ($address !== null) : ?>
                        <div class="border-b border-gray-300 pb-5 flex-1"><h3 class="text-xl md:text-2xl font-bold mb-1">Adress:</h3><span class="text-primary"><?php echo esc_html((string) $address); ?></span></div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</section>

<?php if (is_numeric($lat) && is_numeric($lng)) : ?>
    <div class="max-w-[1240px] mx-auto p-5">
        <iframe src="<?php echo esc_url('https://www.google.com/maps?q=' . $lat . ',' . $lng . '&hl=en&z=15&output=embed'); ?>" width="100%" height="450" style="border:0;filter: grayscale(100%);margin-top: 20px;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Karta"></iframe>
    </div>
<?php endif; ?>

<?php if ($agents['total'] > 0) : ?>
    <div class="max-w-[1240px] mx-auto px-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-7 agents-list"><?php echo $agents['html']; ?></div>
    </div>
<?php endif; ?>

<?php if ($properties['total'] > 0) : ?>
    <div class="max-w-[1240px] mx-auto px-5">
        <div class="flex flex-col md:flex-row items-center justify-between py-5 mb-5 gap-10 border-b border-gray-300">
            <div><h2 class="property-section-title text-3xl font-bold">Ett urval av våra objekt</h2></div>
        </div>
    </div>
    <div class="max-w-[1240px] mx-auto px-5 kowboy-property-list-wrapper">
        <div class="property-list" id="office_<?php echo esc_attr((string) $post_id); ?>" data-reload="<?php echo esc_url(rest_url('core/v1/list')); ?>"
             data-params="<?php echo esc_attr((string) wp_json_encode($properties_params)); ?>" data-page="1" data-hydrate="0">
            <div class="row grid grid-cols-1 md:grid-cols-2 gap-6"><?php echo $properties['html']; ?></div>
            <div class="loading"><span aria-label="Laddar"></span></div>
            <div class="load-more kowboy-property-list-action flex justify-center py-10">
                <button type="button" class="btn min-w-[200px] load-more-button" <?php echo $properties['has_more'] ? '' : 'hidden'; ?>>Visa fler</button>
            </div>
        </div>
    </div>
<?php endif; ?>
</div>
