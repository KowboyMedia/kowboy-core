<?php
// The form card, dark: the lead form of every page and the interest form of a property page are
// this part with a title and a text. The form is a dummy until question 105 is answered: it
// posts nowhere and its button does nothing (Patric, 2026-09-28).
//
// In scope: $title, $text, $subject (a listing's street, or ''; kept for the day 105 is answered).

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
    <form class="k-form" data-subject="<?php echo esc_attr($subject); ?>" onsubmit="return false">
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
            <button class="k-button k-button--light" type="button">Skicka</button>
        </div>
    </form>
</div>
