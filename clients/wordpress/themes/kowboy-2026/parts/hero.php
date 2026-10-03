<?php
// The one hero (docs/kowboy-2026.md): the media behind (a Vimeo video, an uploaded video, one
// image, or several in a Swiper slider with a slight Ken Burns motion), the dark overlay, and
// the content over it. A page's hero and a property's hero are this part with different content.
//
// In scope: $media (kowboy_hero_media), $content (HTML), $variant ('page' or 'property'),
// $wrapper (the opening tag's attributes, optional), $eager (the first image loads at once),
// $extra (HTML placed on the hero itself, after the content: the search card on its lower edge),
// $swipe (the slider slides on a swipe instead of fading by itself; the slides carry their index).

declare(strict_types=1);

$variant = (string) ($variant ?? 'page');
$wrapper = (string) ($wrapper ?? 'class="k-hero k-hero--' . esc_attr($variant) . '"');
$eager = $eager ?? true;
$alt = (string) ($alt ?? '');
$swipe = (bool) ($swipe ?? false);
// A landscape photo covering a portrait phone screen is about two and a half screen widths wide, so the file must be too.
$sizes = '(max-width: 767px) 250vw, 100vw';
?>
<section <?php echo $wrapper; ?>>
    <div class="k-hero__media">
        <?php if ($media['type'] === 'vimeo') : ?>
            <iframe class="k-hero__video" src="https://player.vimeo.com/video/<?php echo esc_attr((string) $media['id']); ?>?background=1&autoplay=1&loop=1&muted=1&dnt=1" title="Film" allow="autoplay; fullscreen" loading="lazy"></iframe>
        <?php elseif ($media['type'] === 'video') : ?>
            <video class="k-hero__video" src="<?php echo esc_url((string) $media['src']); ?>" autoplay muted loop playsinline></video>
        <?php elseif ($media['type'] === 'images' && count($media['images']) === 1) : ?>
            <?php echo kowboy_image($media['images'][0], $sizes, $alt, ['class' => 'k-hero__image'], $eager); ?>
        <?php elseif ($media['type'] === 'images') : ?>
            <div class="swiper k-hero__slider" data-hero-slider<?php echo $swipe ? ' data-hero-swipe' : ''; ?>>
                <div class="swiper-wrapper">
                    <?php foreach ($media['images'] as $index => $url) : ?>
                        <div class="swiper-slide k-hero__slide" data-index="<?php echo (int) $index; ?>"><?php echo kowboy_image($url, $sizes, $alt, ['class' => 'k-hero__image'], $eager && $index === 0); ?></div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endif; ?>
    </div>
    <div class="k-hero__overlay"></div>
    <div class="k-container k-hero__content"><?php echo $content; ?></div>
    <?php echo $extra ?? ''; ?>
</section>
