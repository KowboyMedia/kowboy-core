<?php
// An office page: the banner, the contact card (e-mail, address), the map, the office's agents
// and its properties, both as lists inside this view.
//
// In scope: $post_id, $item, $raw.

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$name = (string) ($item['name'] ?? '');
$email = is_string($item['email'] ?? null) ? $item['email'] : null;
$address = $display['address_line'] ?? null;
$phone = is_array($item['phone'] ?? null) ? $item['phone'] : null;
$lat = $item['lat'] ?? null;
$lng = $item['lng'] ?? null;
$office_id = (string) ($item['id'] ?? '');
$agents = core_client_list(['entity' => 'agent', 'office' => $office_id, 'per_page' => 100, 'shadow' => false]);
$properties = core_client_list(['entity' => 'property', 'office' => $office_id, 'status' => 'for_sale,coming', 'per_page' => 6, 'shadow' => false]);
?>
<section class="k26-banner">
    <div class="k26-banner__content"><h1><?php echo esc_html($name); ?></h1></div>
</section>

<section class="k26-contact-card">
    <?php if ($email !== null) : ?>
        <div class="k26-contact-card__item"><h3>E-post</h3><a href="mailto:<?php echo esc_attr($email); ?>"><?php echo esc_html($email); ?></a></div>
    <?php endif; ?>
    <?php if (is_array($phone) && is_string($phone['display'] ?? null)) : ?>
        <div class="k26-contact-card__item"><h3>Telefon</h3><a href="tel:<?php echo esc_attr((string) ($phone['number'] ?? '')); ?>"><?php echo esc_html($phone['display']); ?></a></div>
    <?php endif; ?>
    <?php if ($address !== null) : ?>
        <div class="k26-contact-card__item"><h3>Adress</h3><span><?php echo esc_html((string) $address); ?></span></div>
    <?php endif; ?>
</section>

<?php if (is_numeric($lat) && is_numeric($lng)) : ?>
    <section class="k26-map">
        <iframe src="<?php echo esc_url('https://maps.google.com/maps?q=' . $lat . ',' . $lng . '&z=15&output=embed'); ?>" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Karta"></iframe>
    </section>
<?php endif; ?>

<?php if ($agents['total'] > 0) : ?>
    <section class="k26-office-agents"><?php echo $agents['html']; ?></section>
<?php endif; ?>

<?php if ($properties['total'] > 0) : ?>
    <section class="k26-office-properties">
        <h2>Ett urval av våra objekt</h2>
        <?php echo $properties['html']; ?>
    </section>
<?php endif; ?>
