<?php
// An agent's page: the card large, the description, the reviews, and the agent's properties.
//
// In scope: $post_id, $item, $raw.

declare(strict_types=1);

$name = (string) ($item['name'] ?? '');
$description = (string) ($item['description'] ?? '');
$reviews = is_array($item['reviews'] ?? null) ? $item['reviews'] : [];
$properties = core_client_list(['entity' => 'property', 'agent' => (string) ($item['id'] ?? ''), 'status' => 'for_sale,coming,sold', 'per_page' => 6, 'title' => 'Bostäder', 'shadow' => false]);
?>
<div class="k-page-top"></div>
<div class="k-container k-agent">
    <div class="k-agent__grid">
        <div class="k-agent__card"><?php echo kowboy_part('agent-card', ['item' => $item, 'post_id' => $post_id]); ?></div>
        <div class="k-agent__body">
            <h1 class="k-section__title"><?php echo esc_html($name); ?></h1>
            <?php if ($description !== '') : ?><div class="k-prose"><?php echo wp_kses_post(wpautop(esc_html($description))); ?></div><?php endif; ?>
            <?php if ($reviews !== []) : ?>
                <div class="k-agent__reviews">
                    <?php foreach ($reviews as $review) : ?>
                        <blockquote class="k-testimonial"><p class="k-testimonial__quote"><?php echo esc_html((string) ($review['text'] ?? '')); ?></p><?php if (is_string($review['author'] ?? null) && $review['author'] !== '') : ?><footer class="k-testimonial__author"><?php echo esc_html($review['author']); ?></footer><?php endif; ?></blockquote>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>
<?php if ($properties['total'] > 0) : ?><?php echo $properties['html']; ?><?php endif; ?>
