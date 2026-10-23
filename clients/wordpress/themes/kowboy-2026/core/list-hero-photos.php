<?php
// The newest listings' photos behind a hero (kowboy_hero_listings), a live part: the hero's
// slider is the list and each home a slide (core/card-hero-photo.php), refreshed in the browser
// like every list, and the script starts the slider again when its photos changed.
//
// In scope: $params, $result, $cards.

declare(strict_types=1);
?>
<div class="swiper k-hero__slider" data-hero-slider<?php echo ($params['swipe'] ?? '') !== '' ? ' data-hero-swipe' : ''; ?> <?php echo core_client_list_data($params, $result); ?>><div class="swiper-wrapper" data-cards><?php echo $cards; ?></div></div>
