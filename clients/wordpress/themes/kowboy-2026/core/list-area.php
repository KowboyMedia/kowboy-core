<?php
// The area list wrapper: a title and the cards, three a row like the properties'.
//
// An archive pages by WordPress's own /page/N/ (parts/paging.php); a list on another page shows
// "Visa fler". The script refreshes the cards once on load (core_client_list_data).
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="k-list k-list--areas" <?php echo core_client_list_data($params, $result); ?>><div class="k-container">
    <?php if (($params['title'] ?? '') !== '') : ?><h2 class="k-section__title"><?php echo esc_html((string) $params['title']); ?></h2><?php endif; ?>
    <p class="k-list__empty" data-empty <?php echo $result['total'] === 0 ? '' : 'hidden'; ?>>Inga områden ännu.</p>
    <div class="k-cards" data-cards><?php echo $cards; ?></div>
    <?php echo $result['key'] === '' ? kowboy_part('paging', ['result' => $result]) : kowboy_part('more', ['result' => $result]); ?>
</div></div>
