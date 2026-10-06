<?php
// The form window (docs/forms.md, "Built 2026-10-06: the first version"; the look approved
// 2026-10-05): one dialog in the page for the three forms, opened by a button marked data-k-form
// and filled per form by the script (assets/kowboy-2026.js, setupFormWindow). A booking starts
// with its times, then the person's step, then the answer; an interest and a free valuation start
// with the person. The window talks only to the plugin's receivers on this site, never to Core,
// so the page holds no key but the bot check's public one. Every word the visitor reads is here
// or in the script; none names a system.
//
// In scope: $endpoint (the plugin's receiver for a form), $slots (its receiver for a viewing's
// times), $policy (the privacy policy's address, or '') and $human (the bot check's provider and
// public key from Core, or null for none).

declare(strict_types=1);

$human = $human ?? null;
?>
<dialog class="k-form" data-endpoint="<?php echo esc_attr($endpoint); ?>" data-slots="<?php echo esc_attr($slots); ?>"<?php if (is_array($human) && $human['provider'] === 'turnstile') : ?> data-human-key="<?php echo esc_attr($human['site_key']); ?>"<?php endif; ?> aria-labelledby="k-form-title">
    <div class="k-form__modal">
        <div class="k-form__top" data-form-top>
            <div>
                <h2 class="k-form__title" id="k-form-title" data-form-title></h2>
                <p class="k-form__sub" data-form-subtitle></p>
            </div>
            <button class="k-form__text-button" type="button" data-form-close>Stäng</button>
        </div>
        <div class="k-form__progress" data-form-progress aria-hidden="true" hidden></div>
        <p class="k-form__sub" data-form-loading hidden>Hämtar…</p>

        <form class="k-form__step" data-form-step="slot" novalidate hidden>
            <div class="k-form__eyebrow">Välj tid</div>
            <div class="k-form__slots" data-form-slots role="radiogroup" aria-label="Välj tid"></div>
            <p class="k-form__sub" data-form-no-times hidden>Det finns inga tider att boka just nu. Kontakta mäklaren så hjälper vi dig.</p>
            <p class="k-form__error" data-form-slot-error hidden>Välj en tid för att gå vidare.</p>
            <div class="k-form__row"><span></span><button class="k-button" type="submit" data-form-next>Fortsätt</button></div>
        </form>

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
            <?php // On an interest and a booking: the visitor may be a seller too, which the brokerage hears with the form. ?>
            <label class="k-form__consent" data-form-current-home><input type="checkbox" name="current_home"><span>Kontakta mig om min nuvarande bostad.</span></label>
            <label class="k-form__consent"><input type="checkbox" name="consent" required><span>Jag samtycker till att mäklaren kontaktar mig och behandlar mina uppgifter enligt <?php if ($policy !== '') : ?><a href="<?php echo esc_url($policy); ?>" target="_blank" rel="noopener">integritetspolicyn</a><?php else : ?>integritetspolicyn<?php endif; ?>.</span></label>
            <p class="k-form__hint" data-form-remembered hidden>Vi minns dina uppgifter från förra gången i den här webbläsaren. <button class="k-form__text-button" type="button" data-form-forget>Glöm mig</button></p>
            <p class="k-form__error" data-form-error hidden>Fyll i alla fält och godkänn integritetspolicyn.</p>
            <?php // The bot check's challenge, which shows itself only when it needs the visitor. ?>
            <div class="k-form__human" data-form-human></div>
            <div class="k-form__row"><span></span><button class="k-button" type="submit" data-form-send>Skicka</button></div>
        </form>

        <div class="k-form__step" data-form-step="end" hidden>
            <div class="k-form__row"><span></span><button class="k-button" type="button" data-form-finish>Klart</button></div>
        </div>

        <div class="k-form__step" data-form-step="fail" hidden>
            <div class="k-form__big" data-form-fail-title></div>
            <p class="k-form__sub" data-form-fail-text></p>
            <div class="k-form__row">
                <button class="k-form__text-button" type="button" data-form-back hidden>Tillbaka</button>
                <button class="k-button" type="button" data-form-retry>Försök igen</button>
            </div>
        </div>
    </div>
</dialog>
