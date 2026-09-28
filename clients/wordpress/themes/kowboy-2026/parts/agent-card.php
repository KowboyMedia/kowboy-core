<?php
// One agent as a card: the picture with the name, the title and the contact on a dark fade at
// the bottom. Used by the agents block, the agent list and a property page's side.
//
// In scope: $item (the agent record), $post_id.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$url = get_permalink($post_id);
$image = is_array($item['image'] ?? null) ? $item['image'] : null;
$phone = is_array($item['phones']['mobile'] ?? null) ? $item['phones']['mobile'] : ($item['phones']['public'] ?? null);
$email = is_string($item['email'] ?? null) ? $item['email'] : null;
$title = is_string($item['title'] ?? null) ? $item['title'] : '';
$office_id = is_string($item['office_id'] ?? null) ? $item['office_id'] : '';
$office = $office_id === '' ? '' : (string) (core_client_items('office', [$office_id])[0]['item']['name'] ?? '');
?>
<article class="k-agent-card">
    <a class="k-agent-card__image" href="<?php echo esc_url($url); ?>">
        <?php echo $image === null ? '<span class="k-agent-card__placeholder"></span>' : kowboy_image($image, '(min-width: 1024px) 298px, 50vw', $name); ?>
    </a>
    <div class="k-agent-card__body">
        <h3 class="k-agent-card__name"><a href="<?php echo esc_url($url); ?>"><?php echo esc_html($name); ?></a></h3>
        <?php if ($title !== '' || $office !== '') : ?><p class="k-agent-card__title"><?php echo esc_html(trim($title . ($title !== '' && $office !== '' ? ', ' : '') . $office)); ?></p><?php endif; ?>
        <p class="k-agent-card__contact">
            <?php if (is_array($phone) && is_string($phone['display'] ?? null)) : ?><a href="tel:<?php echo esc_attr((string) ($phone['number'] ?? '')); ?>"><?php echo esc_html($phone['display']); ?></a><?php endif; ?>
            <?php if ($email !== null) : ?><a href="mailto:<?php echo esc_attr($email); ?>"><?php echo esc_html($email); ?></a><?php endif; ?>
        </p>
    </div>
</article>
