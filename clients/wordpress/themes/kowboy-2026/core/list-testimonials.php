<?php
// The testimonials block's slider (blocks/testimonials): the agents' reviews, a live part whose
// cards are each agent's reviews (core/card-testimonials.php), and the editor's own quotes while
// no agent has one (kowboy_testimonial_quotes). The script starts the slider again when the
// reviews changed.
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="swiper k-testimonials__slider" data-testimonials <?php echo core_client_list_data($params, $result); ?>><div class="swiper-wrapper" data-cards><?php echo $cards !== '' ? $cards : kowboy_testimonial_slides(kowboy_testimonial_quotes()); ?></div><div class="swiper-pagination"></div></div>
