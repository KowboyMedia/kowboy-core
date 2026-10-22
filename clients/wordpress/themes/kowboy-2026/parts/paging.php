<?php
// Page numbers under an archive's cards (Patric, 2026-10-03: pages, not "Visa fler"): WordPress's
// own links (/page/2/), so every page has an address of its own. Nothing when one page holds all.
//
// In scope: $result (total, page, per_page).

declare(strict_types=1);

$pages = (int) ceil($result['total'] / max(1, (int) $result['per_page']));
if ($pages < 2) {
    return;
}
$links = paginate_links([
    'total' => $pages,
    'current' => max(1, (int) $result['page']),
    'prev_text' => '‹',
    'next_text' => '›',
    'type' => 'list',
]);
?>
<?php if (is_string($links) && $links !== '') : ?><nav class="k-paging" aria-label="Sidor"><?php echo $links; ?></nav><?php endif; ?>
