<?php
// An area page, the package's markup: the banner with the area's name (over its first image when
// it has one), the "experts" card with the office's contact and a link to the office, the area's
// descriptions as collapsible sections, the office's agents and the properties in the area, both
// as lists inside this view.
//
// In scope: $post_id, $item, $raw.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$area_id = (string) ($item['id'] ?? '');
$image = is_string($item['images'][0]['url'] ?? null) ? $item['images'][0]['url'] : null;
$office_id = is_string($item['office_id'] ?? null) ? $item['office_id'] : '';
$office = $office_id === '' ? [] : core_client_items('office', [$office_id]);
$office_item = $office[0]['item'] ?? [];
$office_url = isset($office[0]) ? get_permalink($office[0]['post_id']) : null;
$email = is_string($office_item['email'] ?? null) ? $office_item['email'] : null;
$phone = is_array($office_item['phone'] ?? null) ? $office_item['phone'] : null;
$sections = array_filter([
    'Allmänt om området' => $item['surroundings']['area'] ?? null,
    'Kommunikation' => $item['surroundings']['communication'] ?? null,
    'Närservice' => $item['surroundings']['service'] ?? null,
    'Parkering' => $item['surroundings']['parking'] ?? null,
    'Övrigt' => $item['surroundings']['other'] ?? null,
]);
$agents = core_client_list(['entity' => 'agent', 'office' => $office_id, 'per_page' => 100, 'shadow' => false, 'part' => 'cards']);
$properties_params = ['entity' => 'property', 'area_id' => $area_id, 'status' => 'for_sale,coming,sold', 'per_page' => 6];
$properties = core_client_list($properties_params + ['part' => 'cards']);
?>
<div class="template-2025-container">
<section class="relative h-screen overflow-hidden area-banner mb-20">
    <?php if ($image !== null) : ?>
        <div class="absolute inset-0 z-0 animate-kenburns area-banner-img" style="background-image: url('<?php echo esc_url($image); ?>'); background-size: cover; background-position: center;"></div>
    <?php else : ?>
        <div class="absolute inset-0 z-0 animate-kenburns area-banner-img area-banner-img--plain"></div>
    <?php endif; ?>
    <div class="absolute inset-0 bg-black bg-opacity-50 z-10 area-banner-overlay"></div>
    <div class="absolute bottom-0 top-0 left-0 right-0 z-20 text-white p-6 flex items-center area-banner-content">
        <div class="max-w-[1240px] mx-auto area-banner-container flex-1">
            <div class="text-center"><h1 class="lg:text-6xl text-4xl font-bold area-banner-title mb-8"><?php echo esc_html($name); ?></h1></div>
        </div>
    </div>
</section>

<section class="single-area-section">
    <div class="max-w-[1240px] mb-8 mx-auto">
        <div class="single-area-card p-10 md:p-20 bg-stone-100">
            <div class="border-b border-gray-300"><h2 class="single-area-title text-3xl md:text-4xl font-bold mb-1">Experter på <?php echo esc_html($name); ?></h2></div>
            <div class="space-y-8">
                <?php if ($email !== null || (is_array($phone) && is_string($phone['display'] ?? null))) : ?>
                    <div class="single-area-contacts flex flex-col md:flex-row gap-10">
                        <?php if ($email !== null) : ?>
                            <div class="border-b border-gray-300 pb-5 flex-1"><h3 class="text-xl md:text-2xl font-bold mb-1">E-post</h3><a href="mailto:<?php echo esc_attr($email); ?>" class="text-primary hover:underline break-all"><?php echo esc_html($email); ?></a></div>
                        <?php endif; ?>
                        <?php if (is_array($phone) && is_string($phone['display'] ?? null)) : ?>
                            <div class="border-b border-gray-300 pb-5 flex-1"><h3 class="text-xl md:text-2xl font-bold mb-1">Telefon:</h3><a href="tel:<?php echo esc_attr((string) ($phone['number'] ?? '')); ?>" class="text-primary hover:underline"><?php echo esc_html($phone['display']); ?></a></div>
                        <?php endif; ?>
                    </div>
                <?php endif; ?>
                <?php if (is_string($office_url)) : ?>
                    <div class="single-area-actions"><a href="<?php echo esc_url($office_url); ?>" class="btn min-w-[200px]">Kontakta oss</a></div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</section>

<?php if ($sections !== []) : ?>
    <div class="max-w-[1240px] mx-auto py-10 px-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-10 collapsible-items items-start">
            <?php foreach ($sections as $label => $value) : ?>
                <div class="collapsible-item">
                    <button type="button" class="w-full flex items-center justify-between p-4 text-left" data-toggle>
                        <h3 class="text-2xl font-bold"><?php echo esc_html((string) $label); ?></h3>
                        <span class="icon-wrap w-10 h-10 flex items-center justify-center bg-stone-100"><svg class="w-5 h-5 transition-transform duration-300 transform" data-icon fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></span>
                    </button>
                    <div class="content-wrap p-4 hidden" data-content data-open="false"><?php echo nl2br(esc_html((string) $value)); ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
<?php endif; ?>

<?php if ($agents['total'] > 0) : ?>
    <div class="max-w-[1240px] mx-auto px-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-7 agents-list"><?php echo $agents['html']; ?></div>
    </div>
<?php endif; ?>

<?php if ($properties['total'] > 0) : ?>
    <div class="max-w-[1240px] mx-auto px-5">
        <div class="pt-10 gap-10 border-b border-gray-300"><h2 class="property-section-title text-3xl font-bold">Bostäder i <?php echo esc_html($name); ?></h2></div>
    </div>
    <div class="max-w-[1240px] mx-auto px-5 mb-10 kowboy-property-list-wrapper">
        <div class="property-list" id="area_<?php echo esc_attr((string) $post_id); ?>" data-reload="<?php echo esc_url(rest_url('core/v1/list')); ?>"
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
