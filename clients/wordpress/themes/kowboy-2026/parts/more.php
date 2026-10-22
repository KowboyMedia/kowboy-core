<?php
// A list's "Visa fler": an ordinary link to the list's next page, which the server builds with
// every card up to that page (the plugin's list function), so search engines follow it to every
// card. The script loads the next cards in place instead and keeps the address in step. Hidden
// while there are no more cards; a list whose tabs or filters may find more later keeps the
// hidden link (`$always`) for the script to show.
//
// In scope: $result (page, has_more, key), $always (optional).

declare(strict_types=1);

if (!$result['has_more'] && empty($always)) {
    return;
}
?>
<div class="k-list__more">
    <a class="k-button" href="<?php echo esc_url(core_client_list_page_url($result, $result['page'] + 1)); ?>" data-more <?php echo $result['has_more'] ? '' : 'hidden'; ?>>Visa fler</a>
</div>
