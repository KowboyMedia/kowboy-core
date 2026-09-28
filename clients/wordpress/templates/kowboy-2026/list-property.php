<?php
// The property list wrapper, the package's markup: the filter form (max price, smallest living
// space, fewest rooms, a free text for area, city or street), the status buttons, the cards of the
// first page rendered on the server, a spinner and "Visa fler". The script reloads the cards from
// the plugin's endpoint with the same parameter set on load, on a filter change and on "Visa fler".
//
// In scope: $params (the parameter set), $result (items, total, has_more, page), $cards (HTML).

declare(strict_types=1);

$uid = 'sp_' . substr(md5((string) wp_json_encode($params)), 0, 12);
$reload = rest_url('core/v1/list');
$show_filters = !empty($params['filters']);
$show_status_filter = !empty($params['status_filter']);
$all_statuses = (string) ($params['status'] ?? '');
$status_buttons = array_filter(['for_sale' => 'Till salu', 'coming' => 'Kommande'], fn (string $list): bool => core_client_statuses()[$list] !== [], ARRAY_FILTER_USE_KEY);
$max_prices = [50000, 100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 700000, 800000, 900000,
    1000000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000, 4500000, 5000000, 5500000, 6000000, 6500000, 7000000,
    7500000, 8000000, 10000000, 15000000, 20000000, 25000000, 30000000];
$min_spaces = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 170, 180, 200, 250];
$min_rooms = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10, 15, 20];
$chosen = fn (string $key): string => (string) ($params[$key] ?? '');
$hydrate = ($params['hydrate'] ?? '1') !== '0';
?>
<div class="template-2025-container">
    <?php if ($show_filters) : ?>
        <div class="kowboy-property-filter" data-kowboy-filter-for="<?php echo esc_attr($uid); ?>">
            <form class="kowboy-filter-form" method="get" action="">
                <div class="kowboy-filter-card">
                    <div class="kowboy-filter-grid">
                        <div class="kowboy-filter-field">
                            <label for="max_price_<?php echo esc_attr($uid); ?>">Max pris</label>
                            <select id="max_price_<?php echo esc_attr($uid); ?>" name="max_price">
                                <option value="">Max pris</option>
                                <?php foreach ($max_prices as $price) : ?>
                                    <option value="<?php echo (int) $price; ?>" <?php selected($chosen('max_price'), (string) $price); ?>><?php echo esc_html(number_format($price, 0, ',', ' ')); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="kowboy-filter-field">
                            <label for="min_living_space_<?php echo esc_attr($uid); ?>">Minst boarea</label>
                            <select id="min_living_space_<?php echo esc_attr($uid); ?>" name="min_living_space">
                                <option value="">Minst boarea</option>
                                <?php foreach ($min_spaces as $space) : ?>
                                    <option value="<?php echo (int) $space; ?>" <?php selected($chosen('min_living_space'), (string) $space); ?>><?php echo (int) $space; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="kowboy-filter-field">
                            <label for="min_rooms_<?php echo esc_attr($uid); ?>">Minst antal rum</label>
                            <select id="min_rooms_<?php echo esc_attr($uid); ?>" name="min_rooms">
                                <option value="">Minst antal rum</option>
                                <?php foreach ($min_rooms as $rooms) : ?>
                                    <option value="<?php echo esc_attr((string) $rooms); ?>" <?php selected($chosen('min_rooms'), (string) $rooms); ?>><?php echo esc_html((string) $rooms); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="kowboy-filter-field">
                            <label for="area_<?php echo esc_attr($uid); ?>">Område</label>
                            <div class="kowboy-area-field" style="position: relative;">
                                <input id="area_<?php echo esc_attr($uid); ?>" class="kowboy-area-input" type="text" name="area"
                                       value="<?php echo esc_attr($chosen('area')); ?>" placeholder="Sök område, stad eller adress" autocomplete="off">
                            </div>
                        </div>
                    </div>
                    <div class="kowboy-filter-actions">
                        <button type="submit" class="button button-primary">Sök</button>
                    </div>
                </div>
            </form>
        </div>
    <?php endif; ?>

    <?php if ($show_status_filter && $status_buttons !== []) : ?>
        <div class="status-filter" id="filter_<?php echo esc_attr($uid); ?>">
            <div class="status-filter-items">
                <button type="button" data-status="<?php echo esc_attr($all_statuses); ?>" class="active">Alla</button>
                <?php foreach ($status_buttons as $list => $label) : ?>
                    <button type="button" data-status="<?php echo esc_attr($list); ?>"><?php echo esc_html($label); ?></button>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endif; ?>

    <div class="kowboy-property-list-wrapper">
        <div class="property-list search-properties-list" id="<?php echo esc_attr($uid); ?>"
             data-reload="<?php echo esc_url($reload); ?>"
             data-params="<?php echo esc_attr((string) wp_json_encode(array_diff_key($params, ['part' => 1, 'hydrate' => 1]))); ?>"
             data-page="<?php echo (int) $result['page']; ?>" data-hydrate="<?php echo $hydrate ? '1' : '0'; ?>">
            <div class="row"><?php echo $result['total'] === 0 ? '<div class="no-results-message">Ingen fastighet hittades med dina angivna sökkriterier.</div>' : $cards; ?></div>
            <div class="loading"><span aria-label="Laddar"></span></div>
            <div class="load-more">
                <button type="button" class="btn load-more-button" <?php echo $result['has_more'] ? '' : 'hidden'; ?>>Visa fler</button>
            </div>
        </div>
    </div>
</div>
