<?php
// The form card, dark: the lead form of every page and the interest form of a property page are
// this part with a title, a text and what the submission is about (question 105).
//
// In scope: $title, $text, $subject (a listing's street, or '').

declare(strict_types=1);

$privacy = (int) kowboy_option('kowboy_privacy_page');
$privacy_url = $privacy > 0 ? (string) get_permalink($privacy) : '';
$id = 'k-form-' . substr(md5($title . $subject), 0, 8);
?>
<div class="k-lead">
    <div class="k-lead__intro">
        <h2 class="k-lead__title"><?php echo esc_html($title); ?></h2>
        <span class="k-lead__rule"></span>
        <?php if ($text !== '') : ?><p class="k-lead__text"><?php echo esc_html($text); ?></p><?php endif; ?>
    </div>
    <form class="k-form" data-lead-form action="<?php echo esc_url(rest_url('kowboy/v1/lead')); ?>" method="post">
        <input type="hidden" name="subject" value="<?php echo esc_attr($subject); ?>">
        <input type="hidden" name="page" value="<?php echo esc_url((string) (is_singular() ? get_permalink() : home_url(add_query_arg([])))); ?>">
        <input class="k-visually-hidden" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="k-form__row">
            <label class="k-field"><span class="k-field__label">Förnamn</span><input type="text" name="first_name" required autocomplete="given-name"></label>
            <label class="k-field"><span class="k-field__label">Efternamn</span><input type="text" name="last_name" required autocomplete="family-name"></label>
        </div>
        <div class="k-form__row">
            <label class="k-field"><span class="k-field__label">Mobil</span><input type="tel" name="phone" required autocomplete="tel"></label>
            <label class="k-field"><span class="k-field__label">E-post</span><input type="email" name="email" required autocomplete="email"></label>
        </div>
        <div class="k-form__foot">
            <label class="k-form__consent"><input type="checkbox" name="consent" value="1" required>
                <span>Jag samtycker till <?php echo $privacy_url === '' ? 'integritetspolicy' : '<a href="' . esc_url($privacy_url) . '">integritetspolicyn</a>'; ?>.</span></label>
            <button class="k-button k-button--light" type="submit">Skicka</button>
        </div>
        <p class="k-form__message" role="status" aria-live="polite" data-message hidden></p>
    </form>
</div>
