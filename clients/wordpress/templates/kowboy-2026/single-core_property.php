<?php
// A property page, the package's markup: the hero (a slow carousel of the first photos, the
// street, the price wording, the status, the price, four facts), the selling text, the fact list,
// the floor plans, the viewings, the agents and the bids at the side, the gallery with "Visa fler
// bilder", the surroundings, the fact tables (`display.sections`, the association's rows added)
// and the map. Every string is `display`'s or a value shown as sent; what is this site's own is
// named in the block below.
//
// In scope: $post_id, $item (the record as Core delivered it), $raw (the CRM payload).

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$street = (string) ($item['address']['street'] ?? '');
$images = is_array($item['images'] ?? null) ? $item['images'] : [];
// This site's rule: an image the office filed under "Planritning" is a floor plan, the rest are photos.
$plans = array_values(array_filter($images, fn (array $image): bool => ($image['category'] ?? null) === 'Planritning'));
$photos = array_values(array_filter($images, fn (array $image): bool => ($image['category'] ?? null) !== 'Planritning'));
$hero_images = array_map(fn (array $image): string => (string) $image['url'], array_slice($photos, 0, 5));

$sold = isset($display['final_price']);
$price = $sold ? $display['final_price'] : ($display['price'] ?? null);
$price_label = $sold ? 'Slutpris' : ($display['price_text'] ?? null);
$status = (string) ($item['status']['name'] ?? '');
$heading = (string) ($item['heading'] ?? '');
$text = (string) ($item['long_text'] ?? $item['short_text'] ?? '');

$hero_facts = array_filter([
    $display['location'] ?? null,
    $display['rooms'] ?? null,
    $display['living_space'] ?? null,
    isset($display['fee_amount']) ? 'Avgift ' . $display['fee_amount'] : null,
]);
$facts = array_filter([
    $price_label ?? 'Pris' => $price,
    'Område' => $sold ? ($display['location'] ?? null) : null,
    'Rum' => $display['rooms'] ?? null,
    'Avgift' => $sold ? null : ($display['fee_amount'] ?? null),
    'Boarea' => $display['area'] ?? null,
    'Byggnadsår' => $display['year_built'] ?? null,
    'Våning' => $display['floor_and_elevator'] ?? null,
    'Balkong/Uteplats/Bilplats' => $display['exterior_features'] ?? null,
    'Typ' => $item['tenure']['name'] ?? null,
]);

$viewings = [];
foreach (is_array($item['viewings'] ?? null) ? $item['viewings'] : [] as $viewing) {
    $starts = is_string($viewing['starts_at'] ?? null) ? strtotime($viewing['starts_at']) : false;
    $ends = is_string($viewing['ends_at'] ?? null) ? strtotime($viewing['ends_at']) : false;
    if ($starts === false || $starts < time()) {
        continue;
    }
    $viewings[] = [
        'date' => wp_date('D j M', $starts),
        'time' => wp_date('H:i', $starts) . ($ends === false ? '' : ' - ' . wp_date('H:i', $ends)),
        'comment' => (string) ($viewing['comment'] ?? ''),
    ];
}
$no_viewings_text = (string) ($item['viewing_settings']['empty_text'] ?? 'Kontakta oss för visning.');

$agents = core_client_items('agent', is_array($item['agent_ids'] ?? null) ? $item['agent_ids'] : []);

// The bids as the CRM sent them: the office decides what the website may show, Core copies.
$highest_bid = $display['highest_bid'] ?? null;
$bids = is_array($item['bidding']['bids'] ?? null) ? $item['bidding']['bids'] : [];

$surroundings = array_filter([
    'Allmänt om området' => $item['surroundings']['area'] ?? null,
    'Närservice' => $item['surroundings']['service'] ?? null,
    'Kommunikation' => $item['surroundings']['communication'] ?? null,
    'Parkering' => $item['surroundings']['parking'] ?? null,
    'Övrigt' => $item['surroundings']['other'] ?? null,
]);
$area = core_client_items('area', is_array($item['area_ids'] ?? null) ? $item['area_ids'] : []);

// This site's rule, as the master shows it: a sold home keeps its text, facts, plans and photos,
// and shows no fact tables.
$sections = !$sold && is_array($display['sections'] ?? null) ? $display['sections'] : [];
// The housing cooperative is a record of its own; its rows are shown as sent, the fees prepared.
$association = $sold ? null : (core_client_items('association', [$item['association_id'] ?? null])[0]['item'] ?? null);
if ($association !== null) {
    $economy = is_array($association['economy'] ?? null) ? $association['economy'] : [];
    $descriptions = is_array($association['descriptions'] ?? null) ? $association['descriptions'] : [];
    $rows = array_filter([
        'Namn' => $association['name'] ?? null,
        'Allmänt om föreningen' => $descriptions['general_about_association'] ?? null,
        'Renoveringar - utförda och planerade' => $descriptions['renovations'] ?? null,
        'Parkering' => $descriptions['parking'] ?? null,
        'Tv och bredband' => $descriptions['tv_and_broadband'] ?? null,
        'Gårdsplats/innergård' => $descriptions['courtyard'] ?? null,
        'Gemensamma utrymmen' => $descriptions['shared_spaces'] ?? null,
        'Övrigt' => $descriptions['other'] ?? null,
        'Antal lägenheter' => $association['number_of_apartments'] ?? null,
        'Föreningens ekonomi och planerade förändringar' => $economy['finances'] ?? null,
        'Överlåtelseavgift' => $association['display']['transfer_fee'] ?? null,
        'Pantsättningsavgift' => $association['display']['pledge_fee'] ?? null,
        'Organisationsnummer' => $association['corporate_number'] ?? null,
        'Tillåter föreningen delat ägande' => $economy['allows_shared_ownership_info'] ?? null,
        'Äger föreningen marken' => $economy['the_association_own_the_ground'] ?? null,
    ], fn (mixed $value): bool => $value !== null && $value !== '');
    if ($rows !== []) {
        $sections[] = ['header' => 'Föreningen', 'items' => array_map(fn ($label, $value) => ['label' => (string) $label, 'value' => (string) $value], array_keys($rows), $rows)];
    }
}
$lat = $item['lat'] ?? null;
$lng = $item['lng'] ?? null;
$gallery_id = 'kowboy-gallery-' . $post_id;
?>
<div class="template-2025-container">
<section class="relative h-[92vh] md:h-screen overflow-hidden hero-banner">
    <ken-burns-carousel class="absolute inset-0 z-0 hero-banner-img" images="<?php echo esc_attr(implode(' ', $hero_images)); ?>" slide-duration="6000" fade-duration="2000"></ken-burns-carousel>
    <div class="absolute inset-0 bg-black bg-opacity-50 z-10 hero-banner-overlay"></div>
    <div class="absolute bottom-0 left-0 right-0 z-20 text-white p-5 hero-banner-content">
        <div class="max-w-[1200px] mx-auto hero-banner-container">
            <div class="flex flex-col md:flex-row gap-5 justify-between md:items-center text-shadow mb-2 hero-banner-heading">
                <h1 class="lg:text-6xl text-4xl m-0 font-bold hero-banner-title"><?php echo esc_html($street); ?></h1>
                <?php if ($price !== null || $price_label !== null || (!$sold && $status !== '')) : ?>
                    <div class="hero-banner-price">
                        <?php if ($price_label !== null) : ?><p class="text-sm"><?php echo esc_html($price_label); ?></p><?php endif; ?>
                        <div class="hero-price-badge-row">
                            <div class="hero-status-badge">
                                <?php if (!$sold && $status !== '') : ?><span class="sold_label"><?php echo esc_html($status); ?></span><?php endif; ?>
                            </div>
                            <div class="hero-price lg:text-4xl text-xl font-bold md:min-h-10"><?php echo $price === null ? '' : esc_html($price); ?></div>
                        </div>
                    </div>
                <?php endif; ?>
            </div>
            <div class="bg-white h-[1px] my-4 hero-banner-divider"></div>
            <?php if ($hero_facts !== []) : ?>
                <ul class="md:flex grid grid-cols-2 gap-4 text-md text-shadow hero-banner-list list-none p-0">
                    <?php foreach ($hero_facts as $fact) : ?><li><?php echo esc_html((string) $fact); ?></li><?php endforeach; ?>
                </ul>
            <?php endif; ?>
        </div>
    </div>
</section>

<div class="property-container max-w-[1240px] mx-auto px-5 py-10">
    <div class="property-wrapper flex flex-col xl:flex-row gap-10">
        <section class="property-content flex-1">
            <div class="space-y-10">
                <?php if ($heading !== '' || $text !== '') : ?>
                    <div class="property-section space-y-5">
                        <?php if ($heading !== '') : ?><p class="property-excerpt text-lg"><?php echo esc_html($heading); ?></p><?php endif; ?>
                        <?php if ($text !== '') : ?><p class="text-base"><?php echo nl2br(esc_html($text)); ?></p><?php endif; ?>
                    </div>
                <?php endif; ?>
                <?php if ($facts !== []) : ?>
                    <div class="property-section space-y-5">
                        <ul class="property-details-list grid grid-cols-1 md:grid-cols-2 gap-x-10 mb-10 list-none p-0">
                            <?php foreach ($facts as $label => $value) : ?>
                                <li class="item flex gap-10 justify-between items-start border-t-0 border-l-0 border-r-0 border-solid border-b border-gray-200 py-3"><span class="text-base"><?php echo esc_html((string) $label); ?></span><strong class="text-lg font-bold text-right"><?php echo esc_html((string) $value); ?></strong></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                <?php endif; ?>
                <?php if ($plans !== []) : ?>
                    <div class="property-section">
                        <h2 class="property-section-title text-3xl font-bold mb-5">Planlösning</h2>
                        <div class="swiper max-w-[650px] mx-auto pb-10">
                            <div class="swiper-wrapper">
                                <?php foreach ($plans as $plan) : ?>
                                    <div class="swiper-slide">
                                        <a href="<?php echo esc_url((string) $plan['url']); ?>" target="_blank" rel="noopener" aria-label="Öppna planlösning i helskärm">
                                            <img src="<?php echo esc_url((string) $plan['url']); ?>" class="w-auto max-w-full h-full max-h-[60vh] mx-auto object-cover" alt="Planlösning">
                                        </a>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                            <?php if (count($plans) > 1) : ?>
                                <div class="swiper-button-prev"></div>
                                <div class="swiper-button-next"></div>
                                <div class="swiper-pagination"></div>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endif; ?>
            </div>
        </section>

        <aside class="property-sidebar space-y-10 xl:w-[30%] xl:min-w-[450px]">
            <?php if (!$sold) : ?>
                <div class="property-sidebar-item space-y-5">
                    <h3 class="property-sidebar-title text-2xl font-bold">Visningar</h3>
                    <div class="viewings-list flex flex-col gap-5">
                        <?php if ($viewings === []) : ?>
                            <div class="viewings-item flex items-center justify-between gap-5 bg-[#F6F6F2] p-5">
                                <div class="viewings-info flex-1"><div class="viewings-descr text-base"><?php echo esc_html($no_viewings_text); ?></div></div>
                            </div>
                        <?php endif; ?>
                        <?php foreach ($viewings as $viewing) : ?>
                            <div class="viewings-item flex flex-col md:flex-row items-center justify-between gap-5 bg-[#F6F6F2] p-5">
                                <div class="viewings-info flex-1 text-center md:text-left">
                                    <div class="viewings-date text-xl font-bold mb-1"><div><?php echo esc_html($viewing['date']); ?></div><div><?php echo esc_html($viewing['time']); ?></div></div>
                                    <?php if ($viewing['comment'] !== '') : ?><div class="viewings-descr text-base"><?php echo esc_html($viewing['comment']); ?></div><?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <div class="property-sidebar-item space-y-5">
                <h3 class="property-sidebar-title text-2xl font-bold">Mäklare</h3>
                <div class="property-agent-list flex flex-col">
                    <?php if ($agents === []) : ?>
                        <div class="property-agent-item flex items-center gap-5 py-4 border-t border-gray-300 first:border-t-0 first:pt-0">
                            <div class="property-agent-info text-base"><p>Inga agentdata</p></div>
                        </div>
                    <?php endif; ?>
                    <?php foreach ($agents as $agent) : ?>
                        <div class="property-agent-item flex flex-col md:flex-row md:items-center gap-5 py-4 border-t border-l-0 border-r-0 border-gray-300 first:border-t-0 first:pt-0">
                            <?php if (is_string($agent['item']['image']['url'] ?? null)) : ?>
                                <div class="property-agent-img md:max-w-[140px] overflow-hidden rounded-lg">
                                    <img src="<?php echo esc_url($agent['item']['image']['url']); ?>" alt="<?php echo esc_attr((string) ($agent['item']['name'] ?? '')); ?>" class="w-full h-auto block" loading="lazy">
                                </div>
                            <?php endif; ?>
                            <div class="property-agent-info text-base">
                                <h4 class="property-agent-name text-xl font-bold mb-3"><a href="<?php echo esc_url((string) get_permalink($agent['post_id'])); ?>" class="text-black no-underline"><?php echo esc_html((string) ($agent['item']['name'] ?? '')); ?></a></h4>
                                <?php if (is_string($agent['item']['phones']['mobile']['display'] ?? null)) : ?>
                                    <p class="mt-2">Telefon: <a href="tel:<?php echo esc_attr((string) ($agent['item']['phones']['mobile']['number'] ?? '')); ?>" class="hover:underline text-black"><?php echo esc_html($agent['item']['phones']['mobile']['display']); ?></a></p>
                                <?php endif; ?>
                                <?php if (is_string($agent['item']['email'] ?? null)) : ?>
                                    <p class="mt-2">E-post: <a href="mailto:<?php echo esc_attr($agent['item']['email']); ?>" class="hover:underline text-black"><?php echo esc_html($agent['item']['email']); ?></a></p>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <?php if (!$sold && ($highest_bid !== null || $bids !== [])) : ?>
                <div class="property-sidebar-item space-y-5">
                    <h3 class="property-sidebar-title text-2xl font-bold">Budgivning</h3>
                    <?php if ($highest_bid !== null) : ?>
                        <div class="bg-[#F6F6F2] p-5"><span class="font-bold">Högsta Bud:</span> <?php echo esc_html($highest_bid); ?></div>
                    <?php endif; ?>
                    <?php if ($bids !== []) : ?>
                        <div class="bidding-block">
                            <div class="bidding-table border-t border-gray-300 overflow-hidden">
                                <?php $has_cancelled = false; foreach ($bids as $index => $bid) : ?>
                                    <?php $cancelled = ($bid['is_cancelled'] ?? null) === true; $has_cancelled = $has_cancelled || $cancelled; ?>
                                    <div class="bidding-row flex items-center justify-between text-base min-h-[50px] border-b border-gray-300 py-2 gap-4 <?php echo $index >= 3 ? 'extra-row hidden' : ''; ?>">
                                        <div class="w-[30%] font-bold">Budgivare <?php echo esc_html((string) ($bid['alias'] ?? '')); ?></div>
                                        <div class="w-[40%]"><?php echo is_string($bid['placed_at'] ?? null) ? esc_html(wp_date('Y-m-d H:i', (int) strtotime($bid['placed_at']))) : ''; ?></div>
                                        <div class="w-[30%] text-right"><?php echo esc_html(is_numeric($bid['amount'] ?? null) ? number_format((float) $bid['amount'], 0, ',', ' ') . ' kr' : ''); ?><?php echo $cancelled ? '*' : ''; ?></div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                            <?php if ($has_cancelled) : ?><div class="text-sm text-gray-600 mt-2">* - annulerat bud</div><?php endif; ?>
                            <?php if (count($bids) > 3) : ?>
                                <div class="bidding-action pt-4">
                                    <button type="button" id="toggleButton" class="btn gap-4 w-full"><span id="buttonText">Visa all budhistorik</span>
                                        <svg id="arrowIcon" class="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg></button>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </aside>
    </div>
</div>

<?php if ($photos !== []) : ?>
    <div class="max-w-[1240px] mx-auto py-5">
        <div id="<?php echo esc_attr($gallery_id); ?>" class="property-gallery-masonry">
            <div class="masonry-sizer"></div>
            <?php foreach ($photos as $photo) : ?>
                <div class="property-gallery-item masonry-item overflow-hidden rounded-none">
                    <a href="<?php echo esc_url((string) $photo['url']); ?>" class="kowboy-lightbox" target="_blank" rel="noopener">
                        <img src="<?php echo esc_url((string) $photo['url']); ?>" alt="<?php echo esc_attr($street); ?>" class="w-full h-auto block object-cover transform transition-transform duration-300" loading="lazy">
                    </a>
                </div>
            <?php endforeach; ?>
        </div>
        <div class="property-gallery-actions">
            <button type="button" class="gallery-view-more-btn" data-gallery-toggle="<?php echo esc_attr($gallery_id); ?>" aria-expanded="false">Visa fler bilder</button>
        </div>
    </div>
<?php endif; ?>

<?php if ($surroundings !== [] || $area !== []) : ?>
    <section class="m-0 p-0 about-area">
        <div class="max-w-[1240px] mx-auto px-5 py-20">
            <h2 class="property-section-title text-3xl font-bold mb-5">Område</h2>
            <?php if ($area !== []) : ?>
                <div class="mb-8"><p class="m-0"><a href="<?php echo esc_url((string) get_permalink($area[0]['post_id'])); ?>"><?php echo esc_html((string) ($area[0]['item']['name'] ?? '')); ?></a></p></div>
            <?php endif; ?>
            <?php if ($surroundings !== []) : ?>
                <div class="columns-1 md:columns-2 gap-10">
                    <?php foreach ($surroundings as $label => $value) : ?>
                        <div class="break-inside-avoid mb-10 space-y-2"><h3 class="font-bold text-lg"><?php echo esc_html((string) $label); ?>:</h3><?php echo nl2br(esc_html((string) $value)); ?></div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </section>
<?php endif; ?>

<?php if ($sections !== []) : ?>
    <div class="max-w-4xl mx-auto py-10 px-5 kowboy-collapsible-section">
        <div class="grid grid-cols-1 md:grid-cols-1 gap-x-10 collapsible-items items-start">
            <?php foreach ($sections as $section) : ?>
                <div class="collapsible-item">
                    <button type="button" class="w-full flex items-center justify-between p-4 text-left cursor-pointer bg-transparent border-none" data-toggle>
                        <h3 class="text-2xl font-bold m-0"><?php echo esc_html((string) $section['header']); ?></h3>
                        <span class="icon-wrap w-10 h-10 flex items-center justify-center bg-stone-100"><svg class="w-5 h-5 transition-transform duration-300 transform" data-icon fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></span>
                    </button>
                    <div class="content-wrap p-4 hidden" data-content data-open="false">
                        <div class="add-details-list columns-1 md:columns-2 gap-10">
                            <?php foreach ($section['items'] as $row) : ?>
                                <div class="add-details-item mb-10 space-y-2 break-inside-avoid"><strong class="block font-bold mb-1"><?php echo esc_html((string) $row['label']); ?></strong><span><?php echo nl2br(esc_html((string) $row['value'])); ?></span></div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
<?php endif; ?>

<?php if (is_numeric($lat) && is_numeric($lng)) : ?>
    <section class="m-0 p-0">
        <iframe src="<?php echo esc_url('https://maps.google.com/maps?q=' . $lat . ',' . $lng . '&z=15&output=embed'); ?>" width="100%" height="100%" style="border:0;filter:grayscale(1);min-height:400px;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Karta"></iframe>
    </section>
<?php endif; ?>
</div>
