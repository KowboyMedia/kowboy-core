<?php
// The property list wrapper: the filter form, the status buttons, the cards of the first page
// (rendered on the server), and "Visa fler". The script reloads the cards from the reload
// endpoint with the same parameter set on load, on a filter change and on "Visa fler".
//
// In scope: $params (the parameter set), $result (items, total, has_more, page), $cards (HTML).

declare(strict_types=1);

$list_id = 'core-list-' . substr(md5((string) wp_json_encode($params)), 0, 8);
$reload = rest_url('core/v1/list');
$show_filters = !empty($params['filters']);
$show_status_filter = !empty($params['status_filter']);
$all_statuses = (string) ($params['status'] ?? '');
$status_buttons = array_filter(['for_sale' => 'Till salu', 'coming' => 'Kommande'], fn (string $list): bool => core_client_statuses()[$list] !== [], ARRAY_FILTER_USE_KEY);
$max_prices = [50000, 100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 700000, 800000, 900000,
    1000000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000, 4500000, 5000000, 5500000, 6000000, 6500000, 7000000,
    7500000, 8000000, 10000000, 15000000, 20000000, 25000000, 30000000];
$min_spaces = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 250];
$min_rooms = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10, 15, 20];
$chosen = fn (string $key): string => (string) ($params[$key] ?? '');
?>
<div class="k26-list" id="<?php echo esc_attr($list_id); ?>" data-reload="<?php echo esc_url($reload); ?>"
     data-params="<?php echo esc_attr((string) wp_json_encode(array_diff_key($params, ['part' => 1]))); ?>"
     data-page="<?php echo (int) $result['page']; ?>" data-has-more="<?php echo $result['has_more'] ? '1' : '0'; ?>">
    <?php if ($show_filters) : ?>
        <form class="k26-filter" method="get" action="">
            <div class="k26-filter__grid">
                <div class="k26-filter__field">
                    <label for="<?php echo esc_attr($list_id); ?>-max_price">Max pris</label>
                    <select id="<?php echo esc_attr($list_id); ?>-max_price" name="max_price">
                        <option value="">Max pris</option>
                        <?php foreach ($max_prices as $price) : ?>
                            <option value="<?php echo (int) $price; ?>" <?php selected($chosen('max_price'), (string) $price); ?>><?php echo esc_html(number_format($price, 0, ',', ' ')); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="k26-filter__field">
                    <label for="<?php echo esc_attr($list_id); ?>-min_living_space">Minst boarea</label>
                    <select id="<?php echo esc_attr($list_id); ?>-min_living_space" name="min_living_space">
                        <option value="">Minst boarea</option>
                        <?php foreach ($min_spaces as $space) : ?>
                            <option value="<?php echo (int) $space; ?>" <?php selected($chosen('min_living_space'), (string) $space); ?>><?php echo (int) $space; ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="k26-filter__field">
                    <label for="<?php echo esc_attr($list_id); ?>-min_rooms">Minst antal rum</label>
                    <select id="<?php echo esc_attr($list_id); ?>-min_rooms" name="min_rooms">
                        <option value="">Minst antal rum</option>
                        <?php foreach ($min_rooms as $rooms) : ?>
                            <option value="<?php echo esc_attr((string) $rooms); ?>" <?php selected($chosen('min_rooms'), (string) $rooms); ?>><?php echo esc_html((string) $rooms); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="k26-filter__field">
                    <label for="<?php echo esc_attr($list_id); ?>-area">Område</label>
                    <input type="text" id="<?php echo esc_attr($list_id); ?>-area" name="area" value="<?php echo esc_attr($chosen('area')); ?>"
                           placeholder="Sök område, stad eller adress" autocomplete="off">
                </div>
            </div>
            <div class="k26-filter__actions">
                <button type="submit" class="k26-button k26-button--primary">Sök</button>
            </div>
        </form>
    <?php endif; ?>

    <?php if ($show_status_filter && $status_buttons !== []) : ?>
        <div class="k26-status-filter">
            <button type="button" data-status="<?php echo esc_attr($all_statuses); ?>" class="is-active">Alla</button>
            <?php foreach ($status_buttons as $list => $label) : ?>
                <button type="button" data-status="<?php echo esc_attr($list); ?>"><?php echo esc_html($label); ?></button>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>

    <div class="k26-cards"><?php echo $cards; ?></div>
    <p class="k26-list__empty" <?php echo $result['total'] === 0 ? '' : 'hidden'; ?>>Inga bostäder matchar sökningen.</p>
    <div class="k26-list__more">
        <button type="button" class="k26-button k26-list__more-button" <?php echo $result['has_more'] ? '' : 'hidden'; ?>>Visa fler</button>
    </div>
</div>
