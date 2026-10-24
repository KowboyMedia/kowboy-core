<?php
// A list of homes: the filter form when the list asks for one, the cards, the line for none and
// "Visa fler", a link to the list's next page. The wrapper's attributes run it on the plugin's
// list script.
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="t-list" <?php echo core_client_list_data($params, $result); ?>>
<?php if (!empty($params['filters'])) : ?>
<form class="t-filters" method="get" action="" data-filters><?php echo core_client_place_search($params); ?><button type="submit">Sök</button></form>
<?php endif; ?>
<div class="t-cards" data-cards><?php echo $cards; ?></div>
<p class="t-empty" data-empty <?php echo $result['total'] === 0 ? '' : 'hidden'; ?>>Inga bostäder.</p>
<a class="t-more" href="<?php echo esc_url(core_client_list_page_url($result, $result['page'] + 1)); ?>" data-more <?php echo $result['has_more'] ? '' : 'hidden'; ?>>Visa fler</a>
</div>
