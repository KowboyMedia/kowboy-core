<?php
// A property page (the design's Single Property): the hero (a Vimeo link among the links, else
// the photos), the description with fact chips and the floor plan, the viewings and the agent at
// the side, the interest form, the photo grid with "Visa fler bilder", the fact tables
// (`display.sections`, the association's rows added), the area with its texts, the map, and the
// lead form of the footer. Every string is `display`'s or a value shown as sent; this site's own
// rules are named where they apply.
//
// In scope: $post_id, $item (the record as Core delivered it), $raw (the CRM payload).

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$street = (string) ($item['address']['street'] ?? '');
$images = is_array($item['images'] ?? null) ? $item['images'] : [];
// This site's rule: an image the office filed under "Planritning" is a floor plan, the rest are photos.
$plans = array_values(array_filter($images, fn (array $image): bool => ($image['category'] ?? null) === 'Planritning'));
$photos = array_values(array_filter($images, fn (array $image): bool => ($image['category'] ?? null) !== 'Planritning'));
$hero = kowboy_hero_media(is_array($item['links'] ?? null) ? $item['links'] : [], array_map(fn (array $image): string => (string) $image['url'], array_slice($photos, 0, 5)));
// Every photo at the CDN's largest width, for the full-screen slider a click on a photo opens.
$full_photos = array_map(fn (array $image): string => kowboy_image_at((string) $image['url'], 1920), $photos);

$sold = isset($display['final_price']);
$price = $sold ? $display['final_price'] : ($display['price'] ?? null);
$price_label = $sold ? 'Slutpris' : ($display['price_text'] ?? null);
$status = (string) ($item['status']['name'] ?? '');
$location = (string) ($display['location'] ?? '');
$text = (string) ($item['long_text'] ?? $item['short_text'] ?? '');
$heading = (string) ($item['heading'] ?? '');

$chips = array_filter([
    $price === null ? null : trim(($sold ? 'Slutpris ' : (($price_label ?? '') === '' ? '' : $price_label . ' ')) . $price),
    $display['rooms'] ?? null,
    isset($display['fee_amount']) ? $display['fee_amount'] . '/mån' : null,
    $display['living_space'] ?? null,
    isset($display['year_built']) ? 'Byggår ' . $display['year_built'] : null,
    $display['floor_and_elevator'] ?? null,
    $display['exterior_features'] ?? null,
    $item['tenure']['name'] ?? null,
]);

$viewings = [];
foreach (is_array($item['viewings'] ?? null) ? $item['viewings'] : [] as $viewing) {
    $starts = is_string($viewing['starts_at'] ?? null) ? strtotime($viewing['starts_at']) : false;
    $ends = is_string($viewing['ends_at'] ?? null) ? strtotime($viewing['ends_at']) : false;
    if ($starts === false || $starts < time()) {
        continue;
    }
    $viewings[] = [
        'weekday' => wp_date('D', $starts),
        'day' => wp_date('j', $starts),
        'month' => wp_date('M', $starts),
        'time' => wp_date('H:i', $starts) . ($ends === false ? '' : ' – ' . wp_date('H:i', $ends)),
        'comment' => (string) ($viewing['comment'] ?? ''),
    ];
}
$no_viewings_text = (string) ($item['viewing_settings']['empty_text'] ?? 'Kontakta mäklaren eller boka visning nedan.');

$agents = core_client_items('agent', is_array($item['agent_ids'] ?? null) ? $item['agent_ids'] : []);

// This site's rule, as the design shows it: a sold home keeps its text, chips, plan and photos, and shows no fact tables.
$sections = !$sold && is_array($display['sections'] ?? null) ? $display['sections'] : [];
$association = $sold ? null : (core_client_items('association', [$item['association_id'] ?? null])[0]['item'] ?? null);
if ($association !== null) {
    $economy = is_array($association['economy'] ?? null) ? $association['economy'] : [];
    $descriptions = is_array($association['descriptions'] ?? null) ? $association['descriptions'] : [];
    // The master's order (norbanmakleri.se, question 92); the three coded values carry the CRM's names (question 93).
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
        'Överlåtelseavgift betalas av' => $economy['transfer_fee_paid_by']['name'] ?? null,
        'Äkta/Oäkta förening' => $association['genuine_association']['name'] ?? null,
        'Tillåter föreningen juridisk person som köpare' => $economy['allow_legal_person_as_buyer']['name'] ?? null,
        'Tillåter föreningen delat ägande' => $economy['allows_shared_ownership_info'] ?? null,
        'Äger föreningen marken' => $economy['the_association_own_the_ground'] ?? null,
    ], fn (mixed $value): bool => $value !== null && $value !== '');
    if ($rows !== []) {
        $sections[] = ['header' => 'Föreningen', 'items' => array_map(fn ($label, $value) => ['label' => (string) $label, 'value' => (string) $value], array_keys($rows), $rows)];
    }
}
// The documents the CRM lists on the home and on its association, read from both and deduplicated by name
// (question 94, Patric 2026-10-03), each opened from the address Core carries.
$documents = [];
foreach (array_merge(is_array($item['documents'] ?? null) ? $item['documents'] : [], is_array($association['documents'] ?? null) ? $association['documents'] : []) as $document) {
    $name = is_string($document['name'] ?? null) ? trim($document['name']) : '';
    if ($name === '' || !is_string($document['url'] ?? null) || isset($documents[mb_strtolower($name)])) {
        continue;
    }
    $documents[mb_strtolower($name)] = ['name' => $name, 'url' => $document['url']];
}
if ($documents !== [] && !$sold) {
    $sections[] = ['header' => 'Dokument', 'items' => array_values(array_map(fn (array $document): array => ['label' => $document['name'], 'value' => '<a href="' . esc_url($document['url']) . '" target="_blank" rel="noopener">Öppna</a>', 'html' => true], $documents))];
}

$area = core_client_items('area', is_array($item['area_ids'] ?? null) ? $item['area_ids'] : [])[0]['item'] ?? null;
$area_texts = array_filter([
    // The listing's own texts first, the area's where the listing has none; the five the CRM carries.
    'Läge' => $item['surroundings']['area'] ?? ($area['surroundings']['area'] ?? null),
    'Kommunikation' => $item['surroundings']['communication'] ?? ($area['surroundings']['communication'] ?? null),
    'Skolor och service' => $item['surroundings']['service'] ?? ($area['surroundings']['service'] ?? null),
    'Parkering' => $item['surroundings']['parking'] ?? ($area['surroundings']['parking'] ?? null),
    'Övrigt' => $item['surroundings']['other'] ?? ($area['surroundings']['other'] ?? null),
], fn (mixed $value): bool => is_string($value) && $value !== '');
$area_images = array_slice(is_array($area['images'] ?? null) ? $area['images'] : [], 0, 2);
$lat = is_numeric($item['lat'] ?? null) ? (float) $item['lat'] : null;
$lng = is_numeric($item['lng'] ?? null) ? (float) $item['lng'] : null;

$hero_content = '<div class="k-hero__head">'
    . '<div class="k-hero__head-main">'
    . ($location !== '' ? '<p class="k-label k-label--bright">' . esc_html($location) . '</p>' : '')
    . '<h1 class="k-hero__title k-hero__title--left">' . esc_html($street) . '</h1>'
    . '</div>'
    . '<ul class="k-hero__facts">'
    . ($price !== null ? '<li class="k-pill">' . esc_html((string) $price) . ($sold ? ' <span class="k-hero__price-label">Slutpris</span>' : '') . '</li>' : '')
    . (isset($display['rooms']) ? '<li class="k-pill">' . esc_html((string) $display['rooms']) . '</li>' : '')
    . (isset($display['living_space']) ? '<li class="k-pill">' . esc_html((string) $display['living_space']) . '</li>' : '')
    . '</ul></div>';
// A click on the hero's photo opens the full-screen slider (the script finds the gallery's photos).
echo kowboy_part('hero', ['media' => $hero, 'content' => $hero_content, 'variant' => 'property', 'alt' => $street, 'wrapper' => 'class="k-hero k-hero--property"' . ($full_photos === [] ? '' : ' data-lightbox="0"')]);
?>
<div class="k-property">
    <div class="k-container k-property__grid">
        <div class="k-property__main">
            <?php if ($heading !== '') : ?><h2 class="k-heading"><?php echo esc_html($heading); ?></h2><?php else : ?><p class="k-label">Om bostaden</p><?php endif; ?>
            <?php if ($text !== '') : ?><div class="k-property__text"><?php echo wp_kses_post(wpautop(esc_html($text))); ?></div><?php endif; ?>
            <?php if ($chips !== []) : ?>
                <ul class="k-chips"><?php foreach ($chips as $chip) : ?><li class="k-chip"><?php echo esc_html((string) $chip); ?></li><?php endforeach; ?></ul>
            <?php endif; ?>
            <?php if ($plans !== []) : ?>
                <div class="k-plan">
                    <h2 class="k-heading">Planlösning</h2>
                    <?php foreach ($plans as $plan) : ?>
                        <figure class="k-plan__figure"><?php echo kowboy_image($plan, '(min-width: 1024px) 780px, 100vw', 'Planlösning ' . $street, ['class' => 'k-plan__image']); ?>
                            <?php if (is_string($plan['description'] ?? null) && $plan['description'] !== '') : ?><figcaption><?php echo esc_html($plan['description']); ?></figcaption><?php endif; ?></figure>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
        <aside class="k-property__aside">
            <?php if (!$sold) : ?>
                <div class="k-viewings">
                    <h2 class="k-heading">Visningar</h2>
                    <div class="k-viewing">
                        <?php if ($viewings !== []) : ?>
                            <div class="k-viewing__dates">
                                <?php foreach ($viewings as $viewing) : ?>
                                    <div class="k-viewing__date"><span class="k-viewing__weekday"><?php echo esc_html($viewing['weekday']); ?></span><span class="k-viewing__day"><?php echo esc_html($viewing['day']); ?></span><span class="k-viewing__month"><?php echo esc_html($viewing['month']); ?></span><span class="k-viewing__time"><?php echo esc_html($viewing['time']); ?></span></div>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                        <div class="k-viewing__body">
                            <?php $viewing_texts = array_values(array_unique(array_filter(array_column($viewings, 'comment')))); ?>
                            <?php if ($viewing_texts !== []) : ?><?php foreach ($viewing_texts as $viewing_text) : ?><span class="k-viewing__comment"><?php echo esc_html($viewing_text); ?></span><?php endforeach; ?><?php else : ?><span><?php echo esc_html($no_viewings_text); ?></span><?php endif; ?>
                        </div>
                        <a class="k-button" href="#k-interest">Boka här</a>
                    </div>
                </div>
            <?php endif; ?>
            <?php foreach (['Ansvarig mäklare' => array_slice($agents, 0, 1), 'Kontakta även' => array_slice($agents, 1)] as $agents_title => $agents_group) : ?>
                <?php if ($agents_group !== []) : ?>
                    <div class="k-property__agents">
                        <h2 class="k-heading"><?php echo esc_html($agents_title); ?></h2>
                        <?php foreach ($agents_group as $agent) : ?><?php echo kowboy_part('agent-card', ['item' => $agent['item'], 'post_id' => $agent['post_id']]); ?><?php endforeach; ?>
                    </div>
                <?php endif; ?>
            <?php endforeach; ?>
        </aside>
    </div>

    <?php if (!$sold) : ?>
        <div class="k-container" id="k-interest"><?php echo kowboy_part('lead-form', ['title' => 'Är du intresserad av bostaden?', 'text' => 'Ange dina uppgifter här så kontaktar vi dig.', 'subject' => $street]); ?></div>
    <?php endif; ?>

    <?php if ($photos !== []) : ?>
        <div class="k-container k-gallery" data-gallery data-images="<?php echo esc_attr((string) wp_json_encode($full_photos, JSON_UNESCAPED_SLASHES)); ?>">
            <div class="k-gallery__grid">
                <?php foreach ($photos as $index => $photo) : ?>
                    <figure class="k-gallery__item<?php echo $index >= 6 ? ' is-collapsed' : ''; ?>"><button class="k-gallery__button" type="button" data-lightbox="<?php echo (int) $index; ?>" aria-label="Visa bild <?php echo (int) $index + 1; ?> i helskärm"><?php echo kowboy_image($photo, '(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw', $street, ['class' => 'k-gallery__image']); ?></button></figure>
                <?php endforeach; ?>
            </div>
            <?php if (count($photos) > 6) : ?><p class="k-gallery__more"><button class="k-button" type="button" data-gallery-more>Visa fler bilder</button></p><?php endif; ?>
        </div>
    <?php endif; ?>

    <?php
    // Every fact table as one accordion item: a definition list of its rows.
    $tables = [];
    foreach ($sections as $section) {
        $items = is_array($section['items'] ?? null) ? $section['items'] : [];
        if ($items === []) {
            continue;
        }
        $rows = '';
        foreach ($items as $row) {
            $rows .= '<div class="k-kv__row"><dt>' . esc_html((string) ($row['label'] ?? '')) . '</dt><dd>' . (!empty($row['html']) ? wp_kses_post((string) $row['value']) : esc_html((string) ($row['value'] ?? ''))) . '</dd></div>';
        }
        $tables[] = ['label' => (string) ($section['header'] ?? ''), 'html' => '<dl class="k-kv">' . $rows . '</dl>'];
    }
    ?>
    <?php if ($tables !== []) : ?>
        <div class="k-container k-property__tables"><?php echo kowboy_part('accordion', ['items' => $tables, 'open' => true]); ?></div>
    <?php endif; ?>

    <?php if ($area_texts !== [] || $area_images !== []) : ?>
        <section class="k-area">
            <div class="k-container">
                <h2 class="k-section__title"><?php echo esc_html(is_string($area['name'] ?? null) && $area['name'] !== '' ? $area['name'] : 'Område'); ?></h2>
                <?php if ($area_images !== []) : ?>
                    <div class="k-area__images"><?php foreach ($area_images as $image) : ?><figure><?php echo kowboy_image($image, '(min-width: 1024px) 588px, 100vw', (string) ($area['name'] ?? '')); ?></figure><?php endforeach; ?></div>
                <?php endif; ?>
                <?php if ($area_texts !== []) : ?><?php echo kowboy_part('accordion', ['items' => kowboy_text_items($area_texts)]); ?><?php endif; ?>
            </div>
        </section>
    <?php endif; ?>

    <?php if ($lat !== null && $lng !== null) : ?>
        <div class="k-map" data-map data-lat="<?php echo esc_attr((string) $lat); ?>" data-lng="<?php echo esc_attr((string) $lng); ?>" data-title="<?php echo esc_attr($street); ?>"></div>
    <?php endif; ?>
</div>
