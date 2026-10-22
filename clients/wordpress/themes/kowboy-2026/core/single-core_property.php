<?php
// A property page (the design's Single Property): the hero (a Vimeo link among the links, else
// the photos; the list's status label, the price, the rooms and the living space as pills,
// Patric 2026-10-07), the description with fact chips and the floor plan, the viewings, the bids and
// the agents at the side, the interest card, the photos (parts/gallery.php), the fact tables
// (`display.sections`, the association's rows added) closed at first (Patric, 2026-10-03), the
// area with its texts, the map, and the lead form of the footer. The agents, the fact tables and
// the area are live parts (core/card-home-*.php), since they show other records. Every string is `display`'s or a value shown as sent; this site's own
// rules are named where they apply.
//
// In scope: $post_id, $item (the record as Core delivered it), $raw (the CRM payload).

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$street = (string) ($item['address']['street'] ?? '');
// The street as the page's title and the form window's heading show it, its number never starting a line.
$street_title = kowboy_street($street);
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
$label = kowboy_property_label($item);
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
        'id' => is_string($viewing['id'] ?? null) ? $viewing['id'] : '',
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

// The home as the form window names it on a booking and an interest (docs/forms.md, "The clients' part").
$record = 'property:' . (string) core_client_connection_of($post_id) . ':' . (string) ($item['id'] ?? '');
// What the window's step "Söker du bostad?" takes from the home: its rooms and living space to
// prefill, its areas and kommun code to go with the profile (the plugin's core_client_form_wishes).
$wishes = function_exists('core_client_form_wishes') ? (string) wp_json_encode(core_client_form_wishes($post_id, $item)) : '';

// What the page shows from other records is a live part, a list of this home with a card that
// renders it (core/list-part.php, Patric 231 a): rendered here and refreshed in the browser like
// every list, so a kept page never shows an agent, the association or the area as they were.
$part = fn (string $card): string => core_client_list(['entity' => 'property', 'ids' => (string) ($item['id'] ?? ''), 'per_page' => 1, 'page' => 1, 'wrapper' => 'part', 'card' => $card, 'styleisolation' => false])['html'];
$lat = is_numeric($item['lat'] ?? null) ? (float) $item['lat'] : null;
$lng = is_numeric($item['lng'] ?? null) ? (float) $item['lng'] : null;

$hero_content = '<div class="k-hero__head">'
    . '<div class="k-hero__head-main">'
    . ($location !== '' ? '<p class="k-label k-label--bright">' . esc_html($location) . '</p>' : '')
    . '<h1 class="k-hero__title k-hero__title--left">' . esc_html($street_title) . '</h1>'
    . '</div>'
    . '<ul class="k-hero__facts">'
    . ($label !== '' ? '<li class="k-pill">' . esc_html($label) . '</li>' : '')
    . ($price !== null ? '<li class="k-pill">' . esc_html((string) $price) . ($sold ? ' <span class="k-hero__price-label">Slutpris</span>' : '') . '</li>' : '')
    . (isset($display['rooms']) ? '<li class="k-pill">' . esc_html((string) $display['rooms']) . '</li>' : '')
    . (isset($display['living_space']) ? '<li class="k-pill">' . esc_html((string) $display['living_space']) . '</li>' : '')
    . '</ul></div>';
// The hero slides every photo and swipes; a click on it opens the full-screen slider at that photo (the script finds the gallery's images).
echo kowboy_hero($hero, $hero_content, ['variant' => 'property', 'alt' => $street, 'swipe' => true, 'wrapper' => 'class="k-hero k-hero--property"' . ($photos === [] ? '' : ' data-lightbox="0"')]);
?>
<div class="k-property" data-kowboy-chat-listing-id="<?php echo esc_attr((string) ($item['id'] ?? '')); ?>">
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
                            <?php // Opens the booking window on this viewing (data-viewing shows its times); without the window, the agent's card. ?>
                            <?php if ($viewing['bookable']) : ?><a class="k-button" href="#k-agents" data-k-form="viewing" data-record="<?php echo esc_attr($record); ?>"<?php echo $viewing['id'] === '' ? '' : ' data-viewing="' . esc_attr($viewing['id']) . '"'; ?> data-home="<?php echo esc_attr($street_title); ?>"<?php echo $wishes === '' ? '' : ' data-wishes="' . esc_attr($wishes) . '"'; ?>>Boka här</a><?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                    <div class="k-viewing k-viewing--empty" data-viewings-empty <?php echo $upcoming > 0 ? 'hidden' : ''; ?>>
                        <div class="k-viewing__body"><span><?php echo esc_html($no_viewings_text); ?></span></div>
                        <?php // Without a viewing the button takes the visitor to the agent's contact, not the form (Patric, 2026-10-04). ?>
                        <a class="k-button" href="#k-agents">Kontakta oss</a>
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
            <?php echo $part('home-agents'); ?>
        </aside>
    </div>

    <?php if (!$sold) : ?>
        <div class="k-container k-property__interest"><?php echo kowboy_part('form-card', ['title' => 'Är du intresserad av bostaden?', 'text' => 'Anmäl ditt intresse så kontaktar vi dig.', 'label' => 'Anmäl intresse', 'form' => 'interest', 'record' => $record, 'href' => '#k-agents', 'home' => $street_title, 'wishes' => $wishes]); ?></div>
    <?php endif; ?>

    <?php echo kowboy_part('gallery', ['photos' => $gallery, 'alt' => $street]); ?>

    <?php echo $part('home-tables'); ?>

    <?php echo $part('home-area'); ?>

    <?php if ($lat !== null && $lng !== null) : ?>
        <div class="k-map" data-map data-lat="<?php echo esc_attr((string) $lat); ?>" data-lng="<?php echo esc_attr((string) $lng); ?>" data-title="<?php echo esc_attr($street); ?>"></div>
    <?php endif; ?>
</div>
