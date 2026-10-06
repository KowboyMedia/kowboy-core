<?php
// The form window (docs/forms.md, "Built 2026-10-06: the proof"; the look approved 2026-10-05):
// one dialog in the page, opened by a button marked data-k-form and filled per form by the
// script (assets/kowboy-2026.js, setupFormWindow). The person's step, then the answer. The form
// posts to the plugin's receiver on this site, never to Core, so the page holds no key. Every word
// the visitor reads is here or in the script; none names a system.
//
// In scope: $endpoint (the plugin's receiver), $policy (the privacy policy's address, or '').

declare(strict_types=1);
?>
<dialog class="k-form" data-endpoint="<?php echo esc_attr($endpoint); ?>" aria-labelledby="k-form-title">
    <div class="k-form__modal">
        <div class="k-form__top" data-form-top>
            <div>
                <h2 class="k-form__title" id="k-form-title" data-form-title></h2>
                <p class="k-form__sub" data-form-subtitle></p>
            </div>
            <button class="k-form__text-button" type="button" data-form-close>Stäng</button>
        </div>

        <form class="k-form__step" data-form-step="person" novalidate hidden>
            <div class="k-form__eyebrow">Dina uppgifter</div>
            <div class="k-form__grid">
                <label class="k-form__label"><span>Förnamn</span><input class="k-form__field" name="first_name" autocomplete="given-name" required></label>
                <label class="k-form__label"><span>Efternamn</span><input class="k-form__field" name="last_name" autocomplete="family-name" required></label>
                <label class="k-form__label"><span>Mobil</span><input class="k-form__field" name="phone" type="tel" autocomplete="tel" required></label>
                <label class="k-form__label"><span>E-post</span><input class="k-form__field" name="email" type="email" autocomplete="email" required></label>
            </div>
            <label class="k-form__label"><span>Meddelande (valfritt)</span><textarea class="k-form__field" name="message"></textarea></label>
            <?php // The honeypot: a field no person sees; filled, the form is "sent" and nothing leaves. ?>
            <label class="k-form__trap" aria-hidden="true">Webbplats<input name="website" tabindex="-1" autocomplete="off"></label>
            <label class="k-form__consent"><input type="checkbox" name="consent" required><span>Jag samtycker till att mäklaren kontaktar mig och behandlar mina uppgifter enligt <?php if ($policy !== '') : ?><a href="<?php echo esc_url($policy); ?>" target="_blank" rel="noopener">integritetspolicyn</a><?php else : ?>integritetspolicyn<?php endif; ?>.</span></label>
            <p class="k-form__hint" data-form-remembered hidden>Vi minns dina uppgifter från förra gången i den här webbläsaren. <button class="k-form__text-button" type="button" data-form-forget>Glöm mig</button></p>
            <p class="k-form__error" data-form-error hidden>Fyll i alla fält och godkänn integritetspolicyn.</p>
            <div class="k-form__row"><span></span><button class="k-button" type="submit" data-form-send>Skicka</button></div>
        </form>

        <div class="k-form__step" data-form-step="end" hidden>
            <div class="k-form__row"><span></span><button class="k-button" type="button" data-form-finish>Klart</button></div>
        </div>

        <div class="k-form__step" data-form-step="fail" hidden>
            <div class="k-form__big" data-form-fail-title></div>
            <p class="k-form__sub" data-form-fail-text></p>
            <div class="k-form__row"><span></span><button class="k-button" type="button" data-form-retry>Försök igen</button></div>
        </div>
    </div>
</dialog>
