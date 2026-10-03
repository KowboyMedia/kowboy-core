<?php
// An association's page (Patric, 2026-10-03): its name and contact, its rows (the same as the
// fact table on a home's page), its documents, and the homes in it.
//
// In scope: $post_id, $item, $raw.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$association_id = (string) ($item['id'] ?? '');
$contact = is_array($item['contact'] ?? null) ? $item['contact'] : [];
$home_page = is_string($item['home_page'] ?? null) && $item['home_page'] !== '' ? $item['home_page'] : null;
$rows = kowboy_association_rows($item);
unset($rows['Namn']);
$documents = array_values(array_filter(is_array($item['documents'] ?? null) ? $item['documents'] : [], fn (mixed $document): bool => is_array($document) && is_string($document['url'] ?? null) && $document['url'] !== ''));
$properties = core_client_list(['entity' => 'property', 'association' => $association_id, 'status' => 'for_sale,coming,sold', 'status_filter' => '1', 'per_page' => 9, 'title' => 'Bostäder i ' . $name, 'shadow' => false]);
$document_icon = '<svg class="k-docs__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>';
?>
<div class="k-page-top"></div>
<div class="k-container k-office k-association">
    <?php if (is_string($item['organizational_form'] ?? null) && $item['organizational_form'] !== '') : ?><p class="k-label"><?php echo esc_html($item['organizational_form']); ?></p><?php endif; ?>
    <h1 class="k-section__title"><?php echo esc_html($name); ?></h1>
    <p class="k-office__contact">
        <?php if (is_string($contact['name'] ?? null) && $contact['name'] !== '') : ?><span><?php echo esc_html($contact['name']); ?></span><?php endif; ?>
        <?php foreach (['phone', 'mobile'] as $key) : ?><?php if (is_string($contact[$key] ?? null) && $contact[$key] !== '') : ?><a href="tel:<?php echo esc_attr($contact[$key]); ?>"><?php echo esc_html($contact[$key]); ?></a><?php endif; ?><?php endforeach; ?>
        <?php if (is_string($contact['email'] ?? null) && $contact['email'] !== '') : ?><a href="mailto:<?php echo esc_attr($contact['email']); ?>"><?php echo esc_html($contact['email']); ?></a><?php endif; ?>
        <?php if ($home_page !== null) : ?><a href="<?php echo esc_url($home_page); ?>" target="_blank" rel="noopener"><?php echo esc_html(preg_replace('#^https?://(www\.)?#', '', $home_page) ?? $home_page); ?></a><?php endif; ?>
    </p>
    <?php if ($rows !== []) : ?>
        <dl class="k-kv k-association__rows">
            <?php foreach ($rows as $label => $value) : ?><div class="k-kv__row"><dt><?php echo esc_html((string) $label); ?></dt><dd><?php echo esc_html($value); ?></dd></div><?php endforeach; ?>
        </dl>
    <?php endif; ?>
    <?php if ($documents !== []) : ?>
        <h2 class="k-heading">Dokument</h2>
        <ul class="k-docs k-association__docs">
            <?php foreach ($documents as $document) : ?><li class="k-docs__item"><a class="k-docs__link" href="<?php echo esc_url((string) $document['url']); ?>" target="_blank" rel="noopener"><?php echo $document_icon; ?><span class="k-docs__name"><?php echo esc_html((string) ($document['name'] ?? $document['url'])); ?></span></a></li><?php endforeach; ?>
        </ul>
    <?php endif; ?>
</div>
<?php if ($properties['total'] > 0) : ?><?php echo $properties['html']; ?><?php endif; ?>
