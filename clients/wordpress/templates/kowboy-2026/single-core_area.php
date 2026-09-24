<?php
// An area page: the banner with the area's name, the "experts" card with the office's contact,
// the office's agents and the properties in the area, as lists inside this view.
//
// In scope: $post_id, $item, $raw.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$area_id = (string) ($item['id'] ?? '');
$office_id = is_string($item['office_id'] ?? null) ? $item['office_id'] : '';
$office = $office_id === '' ? [] : core_client_items('office', [$office_id]);
$office_item = $office[0]['item'] ?? [];
$office_url = isset($office[0]) ? get_permalink($office[0]['post_id']) : null;
$email = is_string($office_item['email'] ?? null) ? $office_item['email'] : null;
$agents = core_client_list(['entity' => 'agent', 'office' => $office_id, 'per_page' => 100, 'shadow' => false]);
$properties = core_client_list(['entity' => 'property', 'area_id' => $area_id, 'status' => 'for_sale,coming,sold', 'per_page' => 6, 'shadow' => false]);
?>
<section class="k26-banner">
    <div class="k26-banner__content"><h1><?php echo esc_html($name); ?></h1></div>
</section>

<section class="k26-contact-card">
    <h2>Experter på <?php echo esc_html($name); ?></h2>
    <?php if ($email !== null) : ?>
        <div class="k26-contact-card__item"><h3>E-post</h3><a href="mailto:<?php echo esc_attr($email); ?>"><?php echo esc_html($email); ?></a></div>
    <?php endif; ?>
    <?php if (is_string($office_url)) : ?>
        <p><a class="k26-button" href="<?php echo esc_url($office_url); ?>">Kontakta oss</a></p>
    <?php endif; ?>
</section>

<?php if ($agents['total'] > 0) : ?>
    <section class="k26-office-agents"><?php echo $agents['html']; ?></section>
<?php endif; ?>

<?php if ($properties['total'] > 0) : ?>
    <section class="k26-area-properties">
        <h2>Bostäder i <?php echo esc_html($name); ?></h2>
        <?php echo $properties['html']; ?>
    </section>
<?php endif; ?>
