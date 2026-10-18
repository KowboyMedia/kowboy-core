<?php
// The property list wrapper: an optional title and lead (from the block), the status tabs, the
// optional filter form, the cards of the pages the address asks for rendered on the server, and
// "Visa fler", a link to the next page. The script refreshes the cards once on load and reloads
// them from the plugin's endpoint with the same parameter set (core_client_list_data), so a card
// the list names (`card`) comes back the same.
//
// In scope: $params (the parameter set), $result (items, total, has_more, page, key), $cards (HTML).

declare(strict_types=1);

$uid = 'k-list-' . substr(md5((string) wp_json_encode($params)), 0, 10);
$tabs = !empty($params['status_filter']) ? array_filter(['' => 'Alla', 'for_sale' => 'Till salu', 'coming' => 'Kommande'], fn (string $list): bool => $list === '' || core_client_statuses()[$list] !== [], ARRAY_FILTER_USE_KEY) : [];
$current = (string) ($params['status'] ?? '');
$default_status = (string) ($params['status'] ?? '');
?>
<div class="k-list" id="<?php echo esc_attr($uid); ?>" <?php echo core_client_list_data($params, $result); ?>>
    <div class="k-container">
        <?php $has_text = ($params['title'] ?? '') !== '' || ($params['lead'] ?? '') !== ''; ?>
        <?php if ($has_text || $tabs !== []) : ?>
            <div class="k-list__head<?php echo $has_text ? '' : ' k-list__head--tabs'; ?>">
                <?php if ($has_text) : ?>
                    <div>
                        <?php if (($params['title'] ?? '') !== '') : ?><h2 class="k-section__title"><?php echo esc_html((string) $params['title']); ?></h2><?php endif; ?>
                        <?php if (($params['lead'] ?? '') !== '') : ?><p class="k-section__lead"><?php echo esc_html((string) $params['lead']); ?></p><?php endif; ?>
                    </div>
                <?php endif; ?>
                <?php if ($tabs !== []) : ?>
                    <div class="k-tabs" role="tablist">
                        <?php foreach ($tabs as $value => $label) : ?>
                            <button class="k-tab<?php echo ($value === '' ? $current === $default_status : $current === $value) ? ' is-active' : ''; ?>" type="button" role="tab" data-tab="<?php echo esc_attr($value === '' ? $default_status : (string) $value); ?>"><?php echo esc_html($label); ?></button>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>
        <?php if (!empty($params['filters'])) : ?>
            <div class="k-list__filters"><?php echo kowboy_part('search-form', ['params' => $params]); ?></div>
        <?php endif; ?>
        <div class="k-cards" data-cards><?php echo $cards; ?></div>
        <p class="k-list__empty" data-empty <?php echo $result['total'] === 0 ? '' : 'hidden'; ?>>Inga bostäder matchar just nu.</p>
        <?php echo kowboy_part('more', ['result' => $result, 'always' => true]); ?>
    </div>
</div>
