<?php
// An office's page: name, address and contact, its description, its agents and its properties.
//
// In scope: $post_id, $item, $raw.

declare(strict_types=1);

$display = is_array($item['display'] ?? null) ? $item['display'] : [];
$name = (string) ($item['name'] ?? '');
$office_id = (string) ($item['id'] ?? '');
$email = is_string($item['email'] ?? null) ? $item['email'] : null;
$phone = is_array($item['phone'] ?? null) ? $item['phone'] : null;
$agents = core_client_list(['entity' => 'agent', 'office' => $office_id, 'per_page' => 100, 'title' => 'Våra mäklare', 'shadow' => false]);
$properties = core_client_list(['entity' => 'property', 'office' => $office_id, 'status' => 'for_sale,coming', 'per_page' => 9, 'title' => 'Till salu', 'shadow' => false]);
?>
<div class="k-page-top"></div>
<div class="k-container k-office">
    <h1 class="k-section__title"><?php echo esc_html($name); ?></h1>
    <p class="k-office__contact">
        <?php if (isset($display['address_line'])) : ?><span><?php echo esc_html((string) $display['address_line']); ?></span><?php endif; ?>
        <?php if (is_array($phone) && is_string($phone['display'] ?? null)) : ?><a href="tel:<?php echo esc_attr((string) ($phone['number'] ?? '')); ?>"><?php echo esc_html($phone['display']); ?></a><?php endif; ?>
        <?php if ($email !== null) : ?><a href="mailto:<?php echo esc_attr($email); ?>"><?php echo esc_html($email); ?></a><?php endif; ?>
    </p>
    <?php if (is_string($item['description'] ?? null) && $item['description'] !== '') : ?><div class="k-prose"><?php echo wp_kses_post(wpautop(esc_html($item['description']))); ?></div><?php endif; ?>
</div>
<?php echo $agents['html']; ?>
<?php if ($properties['total'] > 0) : ?><?php echo $properties['html']; ?><?php endif; ?>
