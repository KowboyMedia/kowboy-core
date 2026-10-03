<?php
// The form card, dark: the lead form in the footer of every page and the interest form of a
// property page are this part with a title and a text. The fields show their names as
// placeholders (Patric, 2026-10-03). The form is a dummy until question 105 is answered: it
// posts nowhere and its button does nothing (Patric, 2026-09-28).
//
// In scope: $title, $text, $subject (a listing's street, or ''; kept for the day 105 is answered).

declare(strict_types=1);

$privacy = (int) kowboy_option('kowboy_privacy_page');
$privacy_url = $privacy > 0 ? (string) get_permalink($privacy) : '';
?>
<div class="k-lead">
    <div class="k-lead__intro">
        <h2 class="k-lead__title"><?php echo esc_html($title); ?></h2>
        <span class="k-lead__rule"></span>
        <?php if ($text !== '') : ?><p class="k-lead__text"><?php echo esc_html($text); ?></p><?php endif; ?>
    </div>
    <form class="k-form" data-subject="<?php echo esc_attr($subject); ?>" onsubmit="return false">
        <div class="k-form__row">
            <input class="k-field" type="text" name="first_name" placeholder="Förnamn" aria-label="Förnamn" required autocomplete="given-name">
            <input class="k-field" type="text" name="last_name" placeholder="Efternamn" aria-label="Efternamn" required autocomplete="family-name">
        </div>
        <div class="k-form__row">
            <input class="k-field" type="tel" name="phone" placeholder="Mobil" aria-label="Mobil" required autocomplete="tel">
            <input class="k-field" type="email" name="email" placeholder="E-post" aria-label="E-post" required autocomplete="email">
        </div>
        <div class="k-form__foot">
            <label class="k-form__consent"><input type="checkbox" name="consent" value="1" required>
                <span>Jag samtycker till <?php echo $privacy_url === '' ? 'integritetspolicy' : '<a href="' . esc_url($privacy_url) . '">integritetspolicyn</a>'; ?>.</span></label>
            <button class="k-button k-button--light" type="button">Skicka</button>
        </div>
    </form>
</div>
