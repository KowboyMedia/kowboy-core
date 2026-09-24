<?php
// An agent page: the card (image, name, title, phone, e-mail, presentation), the reviews, and the
// agent's properties as one list, inside this page's own view (so no second shadow root).
//
// In scope: $post_id, $item (the record as Core delivered it), $raw (the CRM payload).

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$title = (string) ($item['title'] ?? '');
$image = is_string($item['image']['url'] ?? null) ? $item['image']['url'] : null;
$phone = is_array($item['phones']['mobile'] ?? null) ? $item['phones']['mobile'] : ($item['phones']['public'] ?? null);
$email = is_string($item['email'] ?? null) ? $item['email'] : null;
$description = (string) ($item['description'] ?? '');
$reviews = is_array($item['reviews'] ?? null) ? $item['reviews'] : [];
$properties = core_client_list(['entity' => 'property', 'agent' => (string) ($item['id'] ?? ''), 'status' => 'for_sale,coming,sold', 'per_page' => 6, 'shadow' => false]);
?>
<section class="k26-agent-card">
    <?php if ($image !== null) : ?>
        <div class="k26-agent-card__image"><img src="<?php echo esc_url($image); ?>" alt="<?php echo esc_attr($name); ?>"></div>
    <?php endif; ?>
    <div class="k26-agent-card__info">
        <h2><?php echo esc_html($name); ?></h2>
        <?php if ($title !== '') : ?><p class="k26-agent-card__title"><?php echo esc_html($title); ?></p><?php endif; ?>
        <ul class="k26-agent-card__contact">
            <?php if (is_array($phone) && is_string($phone['display'] ?? null)) : ?>
                <li><strong>Telefon:</strong> <a href="tel:<?php echo esc_attr((string) ($phone['number'] ?? '')); ?>"><?php echo esc_html($phone['display']); ?></a></li>
            <?php endif; ?>
            <?php if ($email !== null) : ?>
                <li><strong>E-post:</strong> <a href="mailto:<?php echo esc_attr($email); ?>"><?php echo esc_html($email); ?></a></li>
            <?php endif; ?>
        </ul>
        <?php if ($description !== '') : ?>
            <div class="k26-agent-card__text"><?php echo wp_kses_post(wpautop($description)); ?></div>
        <?php endif; ?>
    </div>
</section>

<?php if ($reviews !== []) : ?>
    <section class="k26-reviews">
        <h2>Kundomdömen</h2>
        <?php foreach ($reviews as $review) : ?>
            <article class="k26-review">
                <p><?php echo esc_html((string) ($review['text'] ?? '')); ?></p>
                <?php if (is_string($review['author'] ?? null)) : ?><footer><?php echo esc_html($review['author']); ?></footer><?php endif; ?>
            </article>
        <?php endforeach; ?>
    </section>
<?php endif; ?>

<?php if ($properties['total'] > 0) : ?>
    <section class="k26-agent-properties">
        <h2>Ett urval av mina objekt</h2>
        <?php echo $properties['html']; ?>
    </section>
<?php endif; ?>
