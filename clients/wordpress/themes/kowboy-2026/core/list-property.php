<?php
// The property list wrapper: an optional title and lead (from the block), the status tabs, the
// optional filter form, the cards of the first page rendered on the server, and "Visa fler". The
// script reloads the cards from the plugin's endpoint with the same parameter set.
//
// In scope: $params (the parameter set), $result (items, total, has_more, page), $cards (HTML).

declare(strict_types=1);

$uid = 'k-list-' . substr(md5((string) wp_json_encode($params)), 0, 10);
$reload = array_diff_key($params, array_flip(['title', 'lead', 'shadow', 'part']));
$tabs = !empty($params['status_filter']) ? array_filter(['' => 'Alla', 'for_sale' => 'Till salu', 'coming' => 'Kommande'], fn (string $list): bool => $list === '' || core_client_statuses()[$list] !== [], ARRAY_FILTER_USE_KEY) : [];
$current = (string) ($params['status'] ?? '');
$default_status = (string) ($params['status'] ?? '');
?>
<div class="k-list" id="<?php echo esc_attr($uid); ?>" data-list data-reload="<?php echo esc_url(rest_url('core/v1/list')); ?>" data-params="<?php echo esc_attr((string) wp_json_encode($reload)); ?>" data-page="<?php echo (int) $result['page']; ?>">
    <div class="k-container">
        <?php if (($params['title'] ?? '') !== '' || ($params['lead'] ?? '') !== '' || $tabs !== []) : ?>
            <div class="k-list__head">
                <div>
                    <?php if (($params['title'] ?? '') !== '') : ?><h2 class="k-section__title"><?php echo esc_html((string) $params['title']); ?></h2><?php endif; ?>
                    <?php if (($params['lead'] ?? '') !== '') : ?><p class="k-section__lead"><?php echo esc_html((string) $params['lead']); ?></p><?php endif; ?>
                </div>
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
            <div class="k-list__filters"><?php echo kowboy_part('search-form', []); ?></div>
        <?php endif; ?>
        <div class="k-cards" data-cards><?php echo $cards; ?></div>
        <p class="k-list__empty" data-empty <?php echo $result['total'] === 0 ? '' : 'hidden'; ?>>Inga bostäder matchar just nu.</p>
        <div class="k-list__more">
            <button class="k-button" type="button" data-more <?php echo $result['has_more'] ? '' : 'hidden'; ?>>Visa fler</button>
        </div>
    </div>
</div>
