<?php
// A property page: the hero with the first images, the selling text, the fact list, the floor
// plans, viewings and agents at the side, the gallery, the fact tables (`display.sections`) and
// the map. Every string is `display`'s or a value shown as sent; what is this site's own is
// named in the block below (which images are plans, what an empty viewing list says).
//
// In scope: $post_id, $item (the record as Core delivered it), $raw (the CRM payload).

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$street = (string) ($item['address']['street'] ?? '');
$images = is_array($item['images'] ?? null) ? $item['images'] : [];
// This site's rule: an image the office filed under "Planritning" is a floor plan, the rest are photos.
$plans = array_values(array_filter($images, fn (array $image): bool => ($image['category'] ?? null) === 'Planritning'));
$photos = array_values(array_filter($images, fn (array $image): bool => ($image['category'] ?? null) !== 'Planritning'));
$hero_images = array_slice($photos, 0, 5);

$sold = isset($display['final_price']);
$price = $sold ? $display['final_price'] : ($display['price'] ?? null);
$price_label = $sold ? 'Slutpris' : ($display['price_text'] ?? null);
$status = (string) ($item['status']['name'] ?? '');
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
?>
<section class="k26-hero">
    <div class="k26-hero__images" data-carousel>
        <?php foreach ($hero_images as $index => $image) : ?>
            <img src="<?php echo esc_url((string) $image['url']); ?>" alt="" class="<?php echo $index === 0 ? 'is-active' : ''; ?>">
        <?php endforeach; ?>
    </div>
    <div class="k26-hero__content">
        <div class="k26-hero__heading">
            <h1><?php echo esc_html($street); ?></h1>
            <div class="k26-hero__price">
                <?php if ($price_label !== null) : ?><p><?php echo esc_html($price_label); ?></p><?php endif; ?>
                <div class="k26-hero__price-row">
                    <?php if (!$sold && $status !== '') : ?><span class="k26-label"><?php echo esc_html($status); ?></span><?php endif; ?>
                    <?php if ($price !== null) : ?><strong><?php echo esc_html($price); ?></strong><?php endif; ?>
                </div>
            </div>
        </div>
        <?php if ($hero_facts !== []) : ?>
            <ul class="k26-hero__facts">
                <?php foreach ($hero_facts as $fact) : ?><li><?php echo esc_html((string) $fact); ?></li><?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </div>
</section>

<div class="k26-property">
    <section class="k26-property__main">
        <?php if ($text !== '') : ?>
            <div class="k26-property__text"><?php echo wp_kses_post(wpautop($text)); ?></div>
        <?php endif; ?>
        <?php if ($facts !== []) : ?>
            <ul class="k26-facts">
                <?php foreach ($facts as $label => $value) : ?>
                    <li><span><?php echo esc_html((string) $label); ?></span><strong><?php echo esc_html((string) $value); ?></strong></li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
        <?php if ($plans !== []) : ?>
            <div class="k26-plans">
                <h2>Planlösning</h2>
                <div class="k26-slider" data-slider>
                    <?php foreach ($plans as $index => $plan) : ?>
                        <a href="<?php echo esc_url((string) $plan['url']); ?>" class="k26-slider__slide<?php echo $index === 0 ? ' is-active' : ''; ?>" target="_blank" rel="noopener">
                            <img src="<?php echo esc_url((string) $plan['url']); ?>" alt="Planlösning" loading="lazy">
                        </a>
                    <?php endforeach; ?>
                    <?php if (count($plans) > 1) : ?>
                        <button type="button" class="k26-slider__prev" aria-label="Föregående planlösning"></button>
                        <button type="button" class="k26-slider__next" aria-label="Nästa planlösning"></button>
                    <?php endif; ?>
                </div>
            </div>
        <?php endif; ?>
    </section>

    <aside class="k26-property__side">
        <?php if (!$sold) : ?>
            <div class="k26-side">
                <h3>Visningar</h3>
                <?php if ($viewings === []) : ?>
                    <div class="k26-viewing"><p><?php echo esc_html($no_viewings_text); ?></p></div>
                <?php else : ?>
                    <?php foreach ($viewings as $viewing) : ?>
                        <div class="k26-viewing">
                            <div class="k26-viewing__when"><div><?php echo esc_html($viewing['date']); ?></div><div><?php echo esc_html($viewing['time']); ?></div></div>
                            <?php if ($viewing['comment'] !== '') : ?><p><?php echo esc_html($viewing['comment']); ?></p><?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        <?php endif; ?>
        <div class="k26-side">
            <h3>Mäklare</h3>
            <?php if ($agents === []) : ?>
                <p>Inga agentdata</p>
            <?php endif; ?>
            <?php foreach ($agents as $agent) : ?>
                <div class="k26-agent">
                    <?php if (is_string($agent['item']['image']['url'] ?? null)) : ?>
                        <img src="<?php echo esc_url($agent['item']['image']['url']); ?>" alt="<?php echo esc_attr((string) ($agent['item']['name'] ?? '')); ?>" loading="lazy">
                    <?php endif; ?>
                    <div class="k26-agent__info">
                        <h4><a href="<?php echo esc_url((string) get_permalink($agent['post_id'])); ?>"><?php echo esc_html((string) ($agent['item']['name'] ?? '')); ?></a></h4>
                        <?php if (is_string($agent['item']['phones']['mobile']['display'] ?? null)) : ?>
                            <p>Telefon: <a href="tel:<?php echo esc_attr((string) ($agent['item']['phones']['mobile']['number'] ?? '')); ?>"><?php echo esc_html($agent['item']['phones']['mobile']['display']); ?></a></p>
                        <?php endif; ?>
                        <?php if (is_string($agent['item']['email'] ?? null)) : ?>
                            <p>E-post: <a href="mailto:<?php echo esc_attr($agent['item']['email']); ?>"><?php echo esc_html($agent['item']['email']); ?></a></p>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </aside>
</div>

<?php if ($photos !== []) : ?>
    <section class="k26-gallery" data-gallery>
        <?php foreach ($photos as $index => $photo) : ?>
            <a href="<?php echo esc_url((string) $photo['url']); ?>" class="k26-gallery__item<?php echo $index >= 6 ? ' is-hidden' : ''; ?>" target="_blank" rel="noopener">
                <img src="<?php echo esc_url((string) $photo['url']); ?>" alt="<?php echo esc_attr($street); ?>" loading="lazy">
            </a>
        <?php endforeach; ?>
        <?php if (count($photos) > 6) : ?>
            <div class="k26-gallery__more"><button type="button" class="k26-button" data-gallery-more>Visa fler bilder</button></div>
        <?php endif; ?>
    </section>
<?php endif; ?>

<?php if ($sections !== []) : ?>
    <section class="k26-sections">
        <?php foreach ($sections as $section) : ?>
            <details class="k26-section">
                <summary><h3><?php echo esc_html((string) $section['header']); ?></h3></summary>
                <dl>
                    <?php foreach ($section['items'] as $row) : ?>
                        <div><dt><?php echo esc_html((string) $row['label']); ?></dt><dd><?php echo esc_html((string) $row['value']); ?></dd></div>
                    <?php endforeach; ?>
                </dl>
            </details>
        <?php endforeach; ?>
    </section>
<?php endif; ?>

<?php if (is_numeric($lat) && is_numeric($lng)) : ?>
    <section class="k26-map">
        <iframe src="<?php echo esc_url('https://maps.google.com/maps?q=' . $lat . ',' . $lng . '&z=15&output=embed'); ?>" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Karta"></iframe>
    </section>
<?php endif; ?>
