<?php
// One agent card, the package's markup: image, name, title, phone and e-mail, as sent.
//
// In scope: $post_id, $item, $params.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$url = get_permalink($post_id);
$image = is_string($item['image']['url'] ?? null) ? $item['image']['url'] : null;
$phone = is_array($item['phones']['mobile'] ?? null) ? $item['phones']['mobile'] : ($item['phones']['public'] ?? null);
$email = is_string($item['email'] ?? null) ? $item['email'] : null;
?>
<div class="overflow-hidden agents-list-item">
    <?php if ($image !== null) : ?>
        <a href="<?php echo esc_url($url); ?>" class="block relative w-full pb-[100%] overflow-hidden agents-list-img rounded-lg">
            <img src="<?php echo esc_url($image); ?>" alt="<?php echo esc_attr($name); ?>" class="absolute inset-0 w-full h-auto object-cover transform transition-transform duration-300 hover:scale-105" loading="lazy">
        </a>
    <?php endif; ?>
    <div class="pt-6 agents-list-info">
        <h3 class="text-xl font-bold mb-0 agents-list-title"><a href="<?php echo esc_url($url); ?>" class="text-primary hover:underline"><?php echo esc_html($name); ?></a></h3>
        <?php if (is_string($item['title'] ?? null)) : ?><p class="text-base text-secondary mb-2 agents-list-position"><?php echo esc_html($item['title']); ?></p><?php endif; ?>
        <?php if ((is_array($phone) && is_string($phone['display'] ?? null)) || $email !== null) : ?>
            <ul class="agents-list-contact list-none pt-3 pl-0">
                <?php if (is_array($phone) && is_string($phone['display'] ?? null)) : ?>
                    <li class="border-b border-gray-300"><b>Telefon:</b> <a href="tel:<?php echo esc_attr((string) ($phone['number'] ?? '')); ?>" class="hover:underline text-black"><?php echo esc_html($phone['display']); ?></a></li>
                <?php endif; ?>
                <?php if ($email !== null) : ?>
                    <li class="border-b border-gray-300"><b>E-post:</b> <a href="mailto:<?php echo esc_attr($email); ?>" class="hover:underline break-all text-black"><?php echo esc_html($email); ?></a></li>
                <?php endif; ?>
            </ul>
        <?php endif; ?>
    </div>
</div>
