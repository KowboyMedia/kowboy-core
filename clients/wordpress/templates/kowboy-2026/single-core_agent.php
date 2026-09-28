<?php
// An agent page, the package's markup: the card (image, name, title, phone, e-mail, presentation),
// the reviews with "show all", and the agent's properties as one list inside this view.
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
$visible_reviews = 3;
$preview_length = 156;
$properties = core_client_list(['entity' => 'property', 'agent' => (string) ($item['id'] ?? ''), 'status' => 'for_sale,coming,sold', 'per_page' => 6, 'shadow' => false, 'part' => 'cards']);
$properties_params = ['entity' => 'property', 'agent' => (string) ($item['id'] ?? ''), 'status' => 'for_sale,coming,sold', 'per_page' => 6];
?>
<div class="template-2025-container">
<section class="agent-card-section bg-stone-100">
    <div class="max-w-[1240px] mx-auto px-5 py-20">
        <div class="agent-card flex flex-col md:flex-row gap-10 lg:gap-20 md:items-start">
            <?php if ($image !== null) : ?>
                <div class="agent-card-img w-full md:w-1/3 overflow-hidden rounded-lg"><img src="<?php echo esc_url($image); ?>" alt="<?php echo esc_attr($name); ?>" class="w-full h-auto rounded-lg object-cover"></div>
            <?php endif; ?>
            <div class="agent-card-info w-full md:w-2/3 space-y-5">
                <div class="space-y-2">
                    <h2 class="agent-card-title text-4xl font-bold"><?php echo esc_html($name); ?></h2>
                    <?php if ($title !== '') : ?><p class="agent-card-position text-lg text-secondary"><?php echo esc_html($title); ?></p><?php endif; ?>
                </div>
                <?php if ((is_array($phone) && is_string($phone['display'] ?? null)) || $email !== null) : ?>
                    <ul class="text-lg agent-card-contact border-t border-gray-300 md:w-2/3 list-none p-0">
                        <?php if (is_array($phone) && is_string($phone['display'] ?? null)) : ?>
                            <li class="border-b border-gray-300 py-3"><strong class="font-bold">Telefon:</strong> <a href="tel:<?php echo esc_attr((string) ($phone['number'] ?? '')); ?>" class="hover:underline text-black"><?php echo esc_html($phone['display']); ?></a></li>
                        <?php endif; ?>
                        <?php if ($email !== null) : ?>
                            <li class="border-b border-gray-300 py-3"><strong class="font-bold">E-post:</strong> <a href="mailto:<?php echo esc_attr($email); ?>" class="hover:underline text-black"><?php echo esc_html($email); ?></a></li>
                        <?php endif; ?>
                    </ul>
                <?php endif; ?>
                <?php if ($description !== '') : ?>
                    <div class="agent-card-text text-base space-y-4"><?php echo nl2br(esc_html($description)); ?></div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</section>

<?php if ($reviews !== []) : ?>
    <section class="agent-testimonials-section bg-white py-10">
        <div class="max-w-[1240px] mx-auto px-5 py-16">
            <h2 class="text-4xl font-bold mb-8">Kundomdömen</h2>
            <div class="space-y-4">
                <?php foreach ($reviews as $index => $review) : ?>
                    <?php $review_text = (string) ($review['text'] ?? ''); $long = mb_strlen($review_text) > $preview_length; ?>
                    <article class="testimonial-card border border-gray-200 rounded-xl bg-white shadow-sm<?php echo $index >= $visible_reviews ? ' is-hidden' : ''; ?>">
                        <div class="p-6 space-y-3">
                            <div class="testimonial-stars flex items-center gap-1">
                                <?php for ($i = 0; $i < 5; $i++) : ?><svg class="testimonial-star is-filled" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 1.5l2.475 5.012 5.53.804-4.002 3.901.945 5.508L10 14.5l-4.948 2.225.945-5.508L2 7.316l5.53-.804L10 1.5z"/></svg><?php endfor; ?>
                            </div>
                            <?php if ($long) : ?>
                                <details class="testimonial-details">
                                    <summary class="testimonial-toggle">
                                        <span class="testimonial-preview"><?php echo esc_html(mb_substr($review_text, 0, $preview_length)); ?>...</span>
                                        <span class="testimonial-toggle-action"><span class="testimonial-read-more">läs mer</span><span class="testimonial-read-less">läs mindre</span>
                                            <svg class="testimonial-toggle-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5.5 7.5l4.5 4.5 4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                    </summary>
                                    <p class="testimonial-text testimonial-text-full text-base"><?php echo esc_html($review_text); ?></p>
                                </details>
                            <?php else : ?>
                                <p class="testimonial-text text-base"><?php echo esc_html($review_text); ?></p>
                            <?php endif; ?>
                        </div>
                        <div class="testimonial-footer flex items-center gap-3 border-t border-gray-200 px-6 py-4">
                            <div class="testimonial-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z"/></svg></div>
                            <p class="text-sm font-semibold"><?php echo esc_html((string) ($review['author'] ?? '')); ?></p>
                        </div>
                    </article>
                <?php endforeach; ?>
            </div>
            <?php if (count($reviews) > $visible_reviews) : ?>
                <div class="testimonial-show-all text-center mt-6">
                    <span class="testimonial-show-btn" role="button" tabindex="0" data-visible-count="<?php echo (int) $visible_reviews; ?>" data-label-collapsed="Visa alla omdömen (<?php echo count($reviews); ?>)" data-label-expanded="Dölj omdömen">
                        <span class="testimonial-show-label">Visa alla omdömen (<?php echo count($reviews); ?>)</span>
                        <svg class="testimonial-toggle-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5.5 7.5l4.5 4.5 4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                </div>
            <?php endif; ?>
        </div>
    </section>
<?php endif; ?>

<?php if ($properties['total'] > 0) : ?>
    <div class="max-w-[1240px] mx-auto px-5 pt-10 single-agent-properties-heading">
        <div class="flex flex-col md:flex-row items-center justify-between gap-10 border-b border-gray-300">
            <div><h2 class="property-section-title text-3xl font-bold m-0">Ett urval av mina objekt</h2></div>
        </div>
    </div>
    <div class="max-w-[1240px] mx-auto px-5 pb-10 kowboy-property-list-wrapper">
        <div class="property-list single-agent-property-list" id="agent_<?php echo esc_attr((string) $post_id); ?>"
             data-reload="<?php echo esc_url(rest_url('core/v1/list')); ?>" data-params="<?php echo esc_attr((string) wp_json_encode($properties_params)); ?>" data-page="1" data-hydrate="0">
            <div class="row grid grid-cols-1 md:grid-cols-2 gap-6"><?php echo $properties['html']; ?></div>
            <div class="loading"><span aria-label="Laddar"></span></div>
            <div class="load-more kowboy-property-list-action flex justify-center py-10">
                <button type="button" class="btn min-w-[200px] load-more-button" <?php echo $properties['has_more'] ? '' : 'hidden'; ?>>Visa fler</button>
            </div>
        </div>
    </div>
<?php endif; ?>
</div>
