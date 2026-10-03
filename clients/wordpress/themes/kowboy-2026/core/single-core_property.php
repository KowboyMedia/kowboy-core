<?php
// A property page (the design's Single Property): the hero (a Vimeo link among the links, else
// the photos), the description with fact chips and the floor plan, the viewings, the bids and
// the agent at the side, the interest form, the photos (parts/gallery.php), the fact tables
// (`display.sections`, the association's rows added) closed at first (Patric, 2026-10-03), the
// area with its texts, the map, and the lead form of the footer. Every string is `display`'s or a value shown as sent; this site's own
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
$hero = kowboy_hero_media(is_array($item['links'] ?? null) ? $item['links'] : [], array_map(fn (array $image): string => (string) $image['url'], $photos));
// Every gallery (the phone slider, the grid, the full-screen slider) shows the photos first and the plans last (Patric, 2026-10-03).
$gallery = array_merge($photos, $plans);

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

// Every viewing, past ones too: the script hides a viewing once it is over, so a cached page
// never freezes one (Patric, 2026-10-03). A viewing's booking button follows its own
// `self_registration`; a viewing from midnight to midnight, or without an end, is a whole day
// and shows no time (the CRM sends no flag for that: question 123).
$viewings = [];
foreach (is_array($item['viewings'] ?? null) ? $item['viewings'] : [] as $viewing) {
    $starts = is_string($viewing['starts_at'] ?? null) ? strtotime($viewing['starts_at']) : false;
    $ends = is_string($viewing['ends_at'] ?? null) ? strtotime($viewing['ends_at']) : false;
    if ($starts === false) {
        continue;
    }
    $whole_day = wp_date('H:i', $starts) === '00:00' && ($ends === false || wp_date('H:i', $ends) === '00:00');
    $until = $ends === false ? strtotime(wp_date('Y-m-d', $starts) . ' 23:59:59 ' . wp_timezone_string()) : $ends;
    $viewings[] = [
        'weekday' => wp_date('D', $starts),
        'day' => wp_date('j', $starts),
        'month' => wp_date('M', $starts),
        'time' => $whole_day ? '' : wp_date('H:i', $starts) . ($ends === false ? '' : ' – ' . wp_date('H:i', $ends)),
        'comment' => (string) ($viewing['comment'] ?? ''),
        'bookable' => ($viewing['self_registration'] ?? null) === true,
        'until' => gmdate('c', $until === false ? $starts : $until),
        'past' => ($until === false ? $starts : $until) < time(),
    ];
}
$visible_limit = is_numeric($item['viewing_settings']['visible_limit'] ?? null) ? (int) $item['viewing_settings']['visible_limit'] : 0;
$no_viewings_text = (string) (($item['viewing_settings']['empty_text'] ?? '') !== '' ? $item['viewing_settings']['empty_text'] : 'Kontakta mäklaren eller boka visning nedan.');
$upcoming = count(array_filter($viewings, fn (array $viewing): bool => !$viewing['past']));

// The bids as the CRM's three settings reach the site (field tables, `bidding`): bidding off,
// nothing; the highest only, one bid; the history, every bid. The highest is
// `display.highest_bid` (R-008); `is_verified` names a verified bidding.
$bidding = is_array($item['bidding'] ?? null) ? $item['bidding'] : [];
$bids = !$sold && ($bidding['is_active'] ?? null) === true && is_array($bidding['bids'] ?? null) ? $bidding['bids'] : [];
usort($bids, fn (array $a, array $b): int => strcmp((string) ($b['placed_at'] ?? ''), (string) ($a['placed_at'] ?? '')));
$highest_bid = $display['highest_bid'] ?? null;

$agents = core_client_items('agent', is_array($item['agent_ids'] ?? null) ? $item['agent_ids'] : []);

// This site's rule, as the design shows it: a sold home keeps its text, chips, plan and photos, and shows no fact tables.
$sections = !$sold && is_array($display['sections'] ?? null) ? $display['sections'] : [];
$association = $sold ? null : (core_client_items('association', [$item['association_id'] ?? null])[0]['item'] ?? null);
if ($association !== null) {
    $rows = kowboy_association_rows($association);
    if ($rows !== []) {
        $sections[] = ['header' => 'Föreningen', 'items' => array_map(fn ($label, $value) => ['label' => (string) $label, 'value' => (string) $value], array_keys($rows), $rows)];
    }
}
// The documents and the links the CRM lists on the home and on its association, read from both
// and deduplicated by address, then by name (question 94, Patric 2026-10-03), each opened from the
// address Core carries, as one list with an icon per kind (Patric, 2026-10-03: "Dokument och länkar").
$resources = [];
$seen = [];
foreach ([
    ['document', is_array($item['documents'] ?? null) ? $item['documents'] : []],
    ['document', is_array($association['documents'] ?? null) ? $association['documents'] : []],
    ['link', is_array($item['links'] ?? null) ? $item['links'] : []],
    ['link', is_array($association['links'] ?? null) ? $association['links'] : []],
] as [$kind, $entries]) {
    foreach ($entries as $entry) {
        $name = is_string($entry['name'] ?? null) ? trim($entry['name']) : '';
        $url = is_string($entry['url'] ?? null) ? trim($entry['url']) : '';
        $key = $url !== '' ? 'url:' . mb_strtolower($url) : 'name:' . $kind . ':' . mb_strtolower($name);
        if ($url === '' || isset($seen[$key]) || isset($seen['name:' . $kind . ':' . mb_strtolower($name)])) {
            continue;
        }
        $seen[$key] = true;
        $seen['name:' . $kind . ':' . mb_strtolower($name)] = true;
        $resources[] = ['kind' => $kind, 'name' => $name !== '' ? $name : $url, 'url' => $url];
    }
}
$resources_html = '';
if ($resources !== [] && !$sold) {
    $icons = [
        'document' => '<svg class="k-docs__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>',
        'link' => '<svg class="k-docs__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>',
    ];
    foreach ($resources as $resource) {
        $resources_html .= '<li class="k-docs__item"><a class="k-docs__link" href="' . esc_url($resource['url']) . '" target="_blank" rel="noopener">' . $icons[$resource['kind']] . '<span class="k-docs__name">' . esc_html($resource['name']) . '</span></a></li>';
    }
    $resources_html = '<ul class="k-docs">' . $resources_html . '</ul>';
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
// The hero slides every photo and swipes; a click on it opens the full-screen slider at that photo (the script finds the gallery's images).
echo kowboy_hero($hero, $hero_content, ['variant' => 'property', 'alt' => $street, 'swipe' => true, 'wrapper' => 'class="k-hero k-hero--property"' . ($photos === [] ? '' : ' data-lightbox="0"')]);
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
                    <?php // Several plans slide, with dots (Patric, 2026-10-03); the files follow the screen's density like every image (srcset) and load at once, so the slider has its height before it is reached. ?>
                    <?php if (count($plans) > 1) : ?><div class="swiper k-plan__slider" data-plan-slider aria-label="Planlösningar"><div class="swiper-wrapper"><?php endif; ?>
                    <?php foreach ($plans as $plan) : ?>
                        <figure class="k-plan__figure<?php echo count($plans) > 1 ? ' swiper-slide' : ''; ?>"><?php echo kowboy_image($plan, '(min-width: 1024px) 780px, 100vw', 'Planlösning ' . $street, ['class' => 'k-plan__image', 'loading' => 'eager']); ?>
                            <?php if (is_string($plan['description'] ?? null) && $plan['description'] !== '') : ?><figcaption><?php echo esc_html($plan['description']); ?></figcaption><?php endif; ?></figure>
                    <?php endforeach; ?>
                    <?php if (count($plans) > 1) : ?></div><div class="swiper-pagination k-plan__dots"></div></div><?php endif; ?>
                </div>
            <?php endif; ?>
        </div>
        <aside class="k-property__aside">
            <?php if (!$sold) : ?>
                <div class="k-viewings" data-viewings data-limit="<?php echo (int) $visible_limit; ?>">
                    <h2 class="k-heading">Visningar</h2>
                    <?php foreach ($viewings as $viewing) : ?>
                        <div class="k-viewing" data-viewing data-until="<?php echo esc_attr($viewing['until']); ?>" <?php echo $viewing['past'] ? 'hidden' : ''; ?>>
                            <div class="k-viewing__date"><span class="k-viewing__weekday"><?php echo esc_html($viewing['weekday']); ?></span><span class="k-viewing__day"><?php echo esc_html($viewing['day']); ?></span><span class="k-viewing__month"><?php echo esc_html($viewing['month']); ?></span></div>
                            <div class="k-viewing__body">
                                <?php if ($viewing['time'] !== '') : ?><span class="k-viewing__time"><?php echo esc_html($viewing['time']); ?></span><?php endif; ?>
                                <?php if ($viewing['comment'] !== '') : ?><span class="k-viewing__comment"><?php echo esc_html($viewing['comment']); ?></span><?php endif; ?>
                            </div>
                            <?php if ($viewing['bookable']) : ?><a class="k-button" href="#k-interest">Boka här</a><?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                    <div class="k-viewing k-viewing--empty" data-viewings-empty <?php echo $upcoming > 0 ? 'hidden' : ''; ?>>
                        <div class="k-viewing__body"><span><?php echo esc_html($no_viewings_text); ?></span></div>
                        <a class="k-button" href="#k-interest">Kontakta oss</a>
                    </div>
                </div>
                <?php if ($bids !== []) : ?>
                    <div class="k-bids">
                        <h2 class="k-heading">Budgivning</h2>
                        <div class="k-bids__box">
                            <?php if ($highest_bid !== null) : ?><p class="k-bids__highest"><span class="k-label">Högsta bud</span><strong><?php echo esc_html((string) $highest_bid); ?></strong></p><?php endif; ?>
                            <?php if (($bidding['is_verified'] ?? null) === true) : ?><p class="k-bids__verified">Verifierad budgivning</p><?php endif; ?>
                            <?php if (count($bids) > 1) : ?>
                            <ol class="k-bids__list">
                                <?php foreach ($bids as $bid) : ?>
                                    <?php $placed = is_string($bid['placed_at'] ?? null) ? strtotime($bid['placed_at']) : false; ?>
                                    <li class="k-bid<?php echo ($bid['is_cancelled'] ?? null) === true ? ' k-bid--cancelled' : ''; ?>">
                                        <span class="k-bid__amount"><?php echo esc_html(is_numeric($bid['amount'] ?? null) ? number_format((float) $bid['amount'], 0, ',', ' ') . ' kr' : ''); ?></span>
                                        <span class="k-bid__meta"><?php echo esc_html(implode(' · ', array_filter([(string) ($bid['alias'] ?? ''), $placed === false ? '' : wp_date('j M H:i', $placed), ($bid['is_cancelled'] ?? null) === true ? 'Återkallat' : '']))); ?></span>
                                    </li>
                                <?php endforeach; ?>
                            </ol>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endif; ?>
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

    <?php echo kowboy_part('gallery', ['photos' => $gallery, 'alt' => $street]); ?>

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
    if ($resources_html !== '') {
        $tables[] = ['label' => 'Dokument och länkar', 'html' => $resources_html];
    }
    ?>
    <?php if ($tables !== []) : ?>
        <div class="k-container k-property__tables"><?php echo kowboy_part('accordion', ['items' => $tables]); ?></div>
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
